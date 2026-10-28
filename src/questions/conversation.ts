import { type Profile, statusFor } from "../facts/status.js";
import type { FactVocabulary } from "../facts/types.js";
import { type OrderEntry, orderTrials, shortlistOf } from "../shortlist/order.js";
import {
  indexTrials,
  nextQuestion,
  type Situation,
  type StopReason,
  type TrialInput,
  UNKNOWN,
} from "./select.js";
import type { ConversationSettings, ScorerName } from "./settings.js";

/**
 * The conversation (spec 0003 §4.3): the intake, in order, then one chosen
 * question at a time until a stop. Pure apart from `answer`, which stands for
 * the person: a patient's knowledge in the measurement, a cached reading of
 * their reply, or later the page.
 *
 * `answer` returns an answer id, or `UNKNOWN`. An unknown marks the fact as
 * asked and changes nothing else. No answer removes a trial: it adds hints,
 * which move a trial down the order.
 */

export interface Step {
  factId: string;
  phase: "intake" | "follow-up";
  /** An answer id, or `UNKNOWN`. */
  reply: string;
  /** The chooser's score for a follow-up; `null` for the intake. */
  score: number | null;
  /** Short-list NCT ids before and after the answer, in order. */
  before: string[];
  after: string[];
  entered: string[];
  left: string[];
}

export interface ConversationInput {
  trials: readonly TrialInput[];
  vocabulary: FactVocabulary;
  settings: ConversationSettings;
  cancerType: string;
  sex: "female" | "male";
  answer: (factId: string) => string;
  /** Defaults to the settings'. */
  scorer?: ScorerName;
  /** Follow-ups after the intake; defaults to the settings'. */
  budget?: number;
  /** `false` for the from-the-start arm: no intake, and its length added to the budget. */
  intake?: boolean;
}

export interface ConversationResult {
  steps: Step[];
  stop: StopReason;
  profile: Profile;
  /** Every trial, in order. */
  order: OrderEntry[];
  shortlist: OrderEntry[];
}

export function runConversation(input: ConversationInput): ConversationResult {
  const { trials, vocabulary, settings, cancerType, sex } = input;
  const index = indexTrials(trials, vocabulary, cancerType);
  const scorer = input.scorer ?? settings.scorer;
  const useIntake = input.intake !== false;
  const budget = (input.budget ?? settings.budget) + (useIntake ? 0 : settings.intake.length);
  const skipped = (factId: string) =>
    settings.skip.some((r) => r.factId === factId && r.sex === sex);

  const profile: Record<string, string> = {};
  const asked = new Set<string>();
  const steps: Step[] = [];
  let order = orderFor(trials, profile, vocabulary);
  const ids = () => shortlistOf(order, settings.shortlistSize).map((e) => e.candidate.nctId);

  const ask = (factId: string, phase: Step["phase"], score: number | null): void => {
    const fact = index.facts.find((f) => f.id === factId);
    if (fact === undefined) throw new Error(`${factId} isn't a fact for ${cancerType}`);
    const reply = input.answer(factId);
    if (reply !== UNKNOWN && !fact.answers.some((a) => a.id === reply))
      throw new Error(`${factId} has no answer ${reply}`);
    const before = ids();
    asked.add(factId);
    if (reply !== UNKNOWN) {
      profile[factId] = reply;
      order = orderFor(trials, profile, vocabulary);
    }
    const after = ids();
    steps.push({
      factId,
      phase,
      reply,
      score,
      before,
      after,
      entered: after.filter((id) => !before.includes(id)),
      left: before.filter((id) => !after.includes(id)),
    });
  };

  const intake = useIntake
    ? settings.intake.filter((f) => !skipped(f) && index.facts.some((x) => x.id === f))
    : [];
  for (const factId of intake) ask(factId, "intake", null);

  const excluded = new Set(useIntake ? settings.intake : []);
  let followUps = 0;
  let stop: StopReason;
  for (;;) {
    const situation: Situation = {
      index,
      order,
      profile,
      asked,
      excluded,
      skip: settings.skip,
      sex,
      shortlistSize: settings.shortlistSize,
      followUps,
      budget,
    };
    const next = nextQuestion(situation, scorer);
    if ("stop" in next) {
      stop = next.stop;
      break;
    }
    ask(next.factId, "follow-up", next.score);
    followUps++;
  }

  return {
    steps,
    stop,
    profile: { ...profile },
    order,
    shortlist: shortlistOf(order, settings.shortlistSize),
  };
}

/** Every trial in order under a profile. A trial the run didn't map has no status. */
export function orderFor(
  trials: readonly TrialInput[],
  profile: Profile,
  vocabulary: FactVocabulary,
): OrderEntry[] {
  return orderTrials(
    trials.map((t) => ({
      candidate: t.candidate,
      status: t.facts === null ? null : statusFor(t.facts, profile, vocabulary),
    })),
  );
}

/**
 * Facts the short list's trials map that the person hasn't answered, with how
 * many of those trials map each: the start of the oncologist sheet. Facts
 * never asked of this person (`skipped`, such as pregnancy for a man) aren't
 * questions for anyone. Most first, then vocabulary order.
 */
export function openQuestions(
  shortlist: readonly OrderEntry[],
  profile: Profile,
  vocabulary: FactVocabulary,
  skipped: readonly string[] = [],
): { factId: string; trials: number }[] {
  const counts = new Map<string, number>();
  for (const e of shortlist) {
    for (const factId of e.status?.unknown ?? []) {
      if (profile[factId] === undefined && !skipped.includes(factId))
        counts.set(factId, (counts.get(factId) ?? 0) + 1);
    }
  }
  const position = new Map(vocabulary.facts.map((f, i) => [f.id, i]));
  return [...counts]
    .map(([factId, trials]) => ({ factId, trials }))
    .sort(
      (a, b) =>
        b.trials - a.trials || (position.get(a.factId) ?? 0) - (position.get(b.factId) ?? 0),
    );
}
