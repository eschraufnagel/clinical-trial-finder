import { type Profile, statusFor } from "../facts/status.js";
import type { FactVocabulary } from "../facts/types.js";
import { type OrderEntry, orderTrials, shortlistOf } from "../shortlist/order.js";
import {
  indexTrials,
  nextQuestion,
  type Situation,
  type StopReason,
  type TrialIndex,
  type TrialInput,
  UNKNOWN,
} from "./select.js";
import type { ConversationSettings, ScorerName } from "./settings.js";

/**
 * The conversation (spec 0003 §4.3): the intake, in order, then one chosen
 * question at a time until a stop. Pure apart from `answer`, which stands for
 * the person: a patient's knowledge in the measurement, or a cached reading
 * of their reply. Since slice 0004 it is also a set of steps
 * (`startConversation`, `nextStep`, `answer`, `changeAnswer`, `stopNow`,
 * `current`), for the page, where the person answers one question at a time;
 * `runConversation` is a loop over them.
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

/** Where a conversation stands: `stop` is `null` until it has stopped. */
export interface ConversationSoFar extends Omit<ConversationResult, "stop"> {
  stop: StopReason | null;
}

/** What a conversation needs to start: everything but the person. */
export type StartInput = Omit<ConversationInput, "answer">;

/** The next question to ask, or why the conversation has stopped. */
export type NextStep =
  | { factId: string; phase: Step["phase"]; score: number | null }
  | { stop: StopReason };

/**
 * A conversation in progress (slice 0004), driven one step at a time: by
 * `runConversation` with every answer known, or by the page with a person
 * answering. Opaque outside this module; read it with `current`.
 */
export interface ConversationState {
  readonly input: StartInput;
  readonly index: TrialIndex;
  readonly scorer: ScorerName;
  readonly budget: number;
  /** The intake still to ask, in order. */
  readonly intake: string[];
  readonly excluded: ReadonlySet<string>;
  readonly profile: Record<string, string>;
  readonly asked: Set<string>;
  readonly steps: Step[];
  order: OrderEntry[];
  followUps: number;
  stop: StopReason | null;
  /** The last `nextStep`, kept so `answer` needn't rank the facts again. */
  pending: NextStep | null;
}

export function runConversation(input: ConversationInput): ConversationResult {
  const state = startConversation(input);
  for (;;) {
    const next = nextStep(state);
    if ("stop" in next) break;
    answer(state, next.factId, input.answer(next.factId));
  }
  const result = current(state);
  if (result.stop === null) throw new Error("the conversation ended without a stop");
  return { ...result, stop: result.stop };
}

export function startConversation(input: StartInput): ConversationState {
  const { trials, vocabulary, settings, cancerType, sex } = input;
  const index = indexTrials(trials, vocabulary, cancerType);
  const useIntake = input.intake !== false;
  const skipped = (factId: string) =>
    settings.skip.some((r) => r.factId === factId && r.sex === sex);
  return {
    input,
    index,
    scorer: input.scorer ?? settings.scorer,
    budget: (input.budget ?? settings.budget) + (useIntake ? 0 : settings.intake.length),
    intake: useIntake
      ? settings.intake.filter((f) => !skipped(f) && index.facts.some((x) => x.id === f))
      : [],
    excluded: new Set(useIntake ? settings.intake : []),
    profile: {},
    asked: new Set(),
    steps: [],
    order: orderFor(trials, {}, vocabulary),
    followUps: 0,
    stop: null,
    pending: null,
  };
}

/** The next question, or the stop. Asking it twice gives the same answer. */
export function nextStep(state: ConversationState): NextStep {
  if (state.stop !== null) return { stop: state.stop };
  if (state.pending !== null) return state.pending;
  const intake = state.intake[0];
  if (intake !== undefined) {
    state.pending = { factId: intake, phase: "intake", score: null };
    return state.pending;
  }
  const { input } = state;
  const situation: Situation = {
    index: state.index,
    order: state.order,
    profile: state.profile,
    asked: state.asked,
    excluded: state.excluded,
    skip: input.settings.skip,
    sex: input.sex,
    shortlistSize: input.settings.shortlistSize,
    followUps: state.followUps,
    budget: state.budget,
  };
  const next = nextQuestion(situation, state.scorer);
  if ("stop" in next) {
    state.stop = next.stop;
    return { stop: next.stop };
  }
  state.pending = { factId: next.factId, phase: "follow-up", score: next.score };
  return state.pending;
}

/**
 * Answers the next question with an answer id or `UNKNOWN`. Refuses any
 * other fact, and an answer the fact doesn't have. An unknown marks the fact
 * asked and moves nothing.
 */
export function answer(state: ConversationState, factId: string, reply: string): Step {
  const next = nextStep(state);
  if ("stop" in next) throw new Error(`The conversation has stopped (${next.stop})`);
  if (next.factId !== factId) throw new Error(`${factId} isn't the next question`);
  const { input } = state;
  const fact = state.index.facts.find((f) => f.id === factId);
  if (fact === undefined) throw new Error(`${factId} isn't a fact for ${input.cancerType}`);
  if (reply !== UNKNOWN && !fact.answers.some((a) => a.id === reply))
    throw new Error(`${factId} has no answer ${reply}`);

  const before = shortlistIds(state);
  state.asked.add(factId);
  if (reply !== UNKNOWN) {
    state.profile[factId] = reply;
    state.order = orderFor(input.trials, state.profile, input.vocabulary);
  }
  const after = shortlistIds(state);
  const step: Step = {
    factId,
    phase: next.phase,
    reply,
    score: next.score,
    before,
    after,
    entered: after.filter((id) => !before.includes(id)),
    left: before.filter((id) => !after.includes(id)),
  };
  state.steps.push(step);
  if (next.phase === "intake") state.intake.shift();
  else state.followUps++;
  state.pending = null;
  return step;
}

/**
 * Changes the answer to a fact already asked, to an answer id or `UNKNOWN`.
 * The order follows the new answer. No more questions are chosen: a
 * conversation not yet stopped stops, as the person's choice.
 */
export function changeAnswer(state: ConversationState, factId: string, reply: string): void {
  if (!state.asked.has(factId)) throw new Error(`${factId} hasn't been asked`);
  const fact = state.index.facts.find((f) => f.id === factId);
  if (reply !== UNKNOWN && !fact?.answers.some((a) => a.id === reply))
    throw new Error(`${factId} has no answer ${reply}`);
  if (reply === UNKNOWN) delete state.profile[factId];
  else state.profile[factId] = reply;
  state.order = orderFor(state.input.trials, state.profile, state.input.vocabulary);
  stopNow(state);
}

/** Stops the questions at the person's request. A conversation already stopped keeps its reason. */
export function stopNow(state: ConversationState): void {
  state.stop ??= "person";
  state.pending = null;
}

/** The conversation as it stands. */
export function current(state: ConversationState): ConversationSoFar {
  return {
    steps: [...state.steps],
    stop: state.stop,
    profile: { ...state.profile },
    order: state.order,
    shortlist: shortlistOf(state.order, state.input.settings.shortlistSize),
  };
}

function shortlistIds(state: ConversationState): string[] {
  return shortlistOf(state.order, state.input.settings.shortlistSize).map((e) => e.candidate.nctId);
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
