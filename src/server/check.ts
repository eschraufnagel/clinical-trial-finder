import { randomUUID } from "node:crypto";
import type { ConversationAnswer } from "../check/carry.js";
import { recordWithoutParse, type TrialRecord } from "../check/record.js";
import { type Check, recordOf, startCheck } from "../check/run.js";
import type { ParseableTrial } from "../criteria/prompt.js";
import type { ParsedCriteria } from "../criteria/types.js";
import type { TrialFacts } from "../facts/types.js";
import { isBudgetStop } from "../models/budget.js";
import { type ModelAdapter, ModelError } from "../models/types.js";
import type { Reading } from "../screening/apply.js";
import type { CallResult } from "../screening/calls.js";
import { type AgentReply, ScreeningSession } from "../screening/session.js";
import { TAP_WORDS, type Tap, tapReading } from "../screening/taps.js";
import type { ReadingValue, StudyContext } from "../screening/types.js";
import type { Choice, InboundMessage, MessageTransport } from "../transport/types.js";
import { CONFIRM, type FinderService, type ReaderSource } from "./finder.js";

/**
 * The deeper check (spec 0007 §6.1): up to three trials a person ticked on
 * their short list, each worked through by the screening agent from the
 * trial's own rules, one at a time, over a `MessageTransport`, in
 * `finder.ts`'s style. It starts from the conversation's answers and never
 * changes them, the list or its order.
 *
 * Every question offers Yes, No, "I don't know" and "Stop and show the
 * record". A tap is applied with no model. Typed text is read by the agent's
 * read call and shown back, and **nothing typed counts until the person
 * confirms it**. A reading that can't be used, or a model that can't be
 * reached, falls back to the taps, saying why; a question the model can't
 * phrase is asked in the trial's own words. So a check works with no model
 * at all, once the trial's rules are parsed.
 *
 * Each trial reads with its own adapter from `ReaderSource.forConversation`,
 * under the conversation's cost cap, the parse included: three trials can
 * spend three caps. A trial whose rules can't be parsed gets the record its
 * fact mappings and the conversation's answers allow, and the check moves on.
 *
 * Sessions live in memory, as the conversation's do.
 */

export interface CheckOptions {
  transport: MessageTransport;
  reader: ReaderSource;
  /** The conversation a check starts from. */
  finder: Pick<FinderService, "checkSource">;
  /** A trial from the snapshot, or undefined. */
  trial: (nctId: string) => ParseableTrial | undefined;
  /** The trial's fact mappings, from the mapping run. */
  facts: (nctId: string) => TrialFacts | undefined;
  /** The trial's parsed rules: from the cache or the model, or, in `--fake`, a committed run. Throws when they can't be had. */
  parse: (trial: ParseableTrial, adapter: ModelAdapter) => Promise<ParsedCriteria>;
  /** Whether a trial can be checked at all. In `--fake`, only trials with a committed parse can. */
  checkable?: (nctId: string) => boolean;
  /** Ask each rule in its own words, with no model (`--fake`). */
  fixedQuestions?: boolean;
  /** Whether typed replies are read. `--fake` has no model to read them. */
  readTyped?: boolean;
  newId?: () => string;
}

export const MAX_CHECKED = 3;

export const TAPS: readonly Choice[] = [
  { id: "yes", label: TAP_WORDS.yes },
  { id: "no", label: TAP_WORDS.no },
  { id: "unknown", label: TAP_WORDS.unknown },
  { id: "stop", label: "Stop and show the record" },
];

export const CHECK_WORDS = {
  reading: (title: string) => `Reading the rules of “${title}”…`,
  noParse:
    "This trial's rules couldn't be read just now. Its record shows the rules your earlier answers covered.",
  parseCapped:
    "This trial reached the cost cap in Settings before its rules could be read. Its record shows the rules your earlier answers covered.",
  noModel: (why: string) =>
    `This trial's rules couldn't be read: ${why} Its record shows the rules your earlier answers covered.`,
  ownWords: "I couldn't word the next question just now, so it's in the trial's own words.",
  readAs: "I read that as:",
  readLine: (rule: string, reading: string) => `“${rule}”: ${reading}`,
  choose: "Please choose an answer.",
  unclear: "I couldn't tell from that. Please choose an answer.",
  unavailable: "I couldn't read that just now. Please choose an answer.",
  unavailableBecause: (why: string) =>
    `I couldn't read that just now: ${why} Please choose an answer.`,
  capped:
    "This trial has reached its cost cap in Settings, so I can't read replies. Please choose an answer.",
  tapsOnly: "Typed replies can't be read in this mode. Please choose an answer.",
  stoppedTrial: "Stopped. This trial's record shows what you've answered so far.",
  allDone: "That's every trial you picked. Their records are ready, for you and your oncologist.",
  stoppedAll: "Stopped. The records show what you've answered so far.",
} as const;

/** How a reading is said back, before the person confirms it. */
export const READING_WORDS: Readonly<Record<ReadingValue, string>> = {
  holds: "yes",
  "does-not-hold": "no",
  partial: "partly",
  unclear: "not clear yet",
  unknown: "you don't know",
  declined: "you'd rather not say",
  "does-not-apply": "this isn't about you",
};

export type CheckStart = { ok: true; id: string } | { ok: false; code: 400 | 404; error: string };

export interface CheckView {
  trials: { nctId: string; title: string }[];
  /** One per trial, in order: its record once checked or stopped, null before. */
  records: (TrialRecord | null)[];
  /** The trial being checked, by its place in `trials`, or null when none is. */
  current: number | null;
  done: boolean;
  model: string;
  measured: boolean;
  hosted: string | null;
  readTyped: boolean;
}

interface Running {
  check: Check;
  adapter: ModelAdapter;
  /** Readings of typed text, waiting for the person to confirm them. */
  pending: { text: string; readings: Reading[]; calls: number } | null;
}

interface Session {
  key: string;
  answers: ReadonlyMap<string, ConversationAnswer>;
  trials: ParseableTrial[];
  records: (TrialRecord | null)[];
  index: number;
  running: Running | null;
  done: boolean;
}

export class CheckService {
  readonly #options: CheckOptions;
  readonly #sessions = new Map<string, Session>();

  constructor(options: CheckOptions) {
    this.#options = options;
    options.transport.onMessage((m) => {
      void this.#onMessage(m);
    });
  }

  /** Which of a conversation's trials can be checked, or undefined for an unknown conversation. */
  checkable(finderId: string): string[] | undefined {
    const source = this.#options.finder.checkSource(finderId);
    return source?.trials.filter((id) => this.#canCheck(id));
  }

  /** Starts a check of up to three trials from a conversation's list. */
  start(body: unknown): CheckStart {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const finderId = b["finderId"];
    const nctIds = b["nctIds"];
    if (typeof finderId !== "string") return { ok: false, code: 400, error: "no-conversation" };
    if (
      !Array.isArray(nctIds) ||
      nctIds.length === 0 ||
      nctIds.length > MAX_CHECKED ||
      !nctIds.every((n) => typeof n === "string") ||
      new Set(nctIds).size !== nctIds.length
    )
      return { ok: false, code: 400, error: "one-to-three-trials" };
    const source = this.#options.finder.checkSource(finderId);
    if (source === undefined) return { ok: false, code: 404, error: "unknown-conversation" };
    const trials: ParseableTrial[] = [];
    for (const nctId of nctIds as string[]) {
      const trial = this.#options.trial(nctId);
      if (!source.trials.includes(nctId) || trial === undefined || !this.#canCheck(nctId))
        return { ok: false, code: 400, error: "not-checkable" };
      trials.push(trial);
    }
    const id = this.#options.newId?.() ?? randomUUID();
    this.#sessions.set(id, {
      key: source.key,
      answers: source.answers,
      trials,
      records: trials.map(() => null),
      index: 0,
      running: null,
      done: false,
    });
    this.#options.transport.open(id, [], "working");
    void this.#begin(id);
    return { ok: true, id };
  }

  view(id: string): CheckView | undefined {
    const session = this.#sessions.get(id);
    if (session === undefined) return undefined;
    const { reader } = this.#options;
    return {
      trials: session.trials.map((t) => ({ nctId: t.nctId, title: t.briefTitle })),
      records: [...session.records],
      current: session.done ? null : session.index,
      done: session.done,
      model: reader.name(session.key),
      measured: reader.measured(session.key),
      hosted: reader.hosted?.(session.key) ?? null,
      readTyped: this.#options.readTyped ?? true,
    };
  }

  /** "Stop": the trial being checked gets its record as it stands, and the rest aren't checked. */
  stop(id: string): boolean {
    const session = this.#sessions.get(id);
    if (session === undefined) return false;
    if (session.done) return true;
    const running = session.running;
    if (running !== null) {
      session.records[session.index] = recordOf(running.check, running.check.session.stop());
      this.#options.reader.release(running.adapter);
      session.running = null;
    }
    this.#close(id, CHECK_WORDS.stoppedAll);
    return true;
  }

  remove(id: string): boolean {
    const session = this.#sessions.get(id);
    if (session === undefined) return false;
    if (session.running !== null) this.#options.reader.release(session.running.adapter);
    this.#sessions.delete(id);
    this.#options.transport.close(id);
    return true;
  }

  #canCheck(nctId: string): boolean {
    return this.#options.trial(nctId) !== undefined && (this.#options.checkable?.(nctId) ?? true);
  }

  /** Parses the next trial and asks its first question, or closes the check. */
  async #begin(id: string): Promise<void> {
    const session = this.#sessions.get(id);
    if (session === undefined) return;
    const trial = session.trials[session.index];
    if (trial === undefined) {
      this.#close(id, CHECK_WORDS.allDone);
      return;
    }
    const { transport, reader } = this.#options;
    const study: StudyContext = { nctId: trial.nctId, briefTitle: trial.briefTitle };
    transport.deliver(id, CHECK_WORDS.reading(trial.briefTitle));
    transport.setStatus(id, "working");

    let adapter: ModelAdapter;
    try {
      adapter = reader.forConversation(session.key);
    } catch (error) {
      this.#withoutParse(id, study, CHECK_WORDS.noModel(withStop(reasonOf(error))));
      return;
    }
    let parsed: ParsedCriteria;
    try {
      parsed = await this.#options.parse(trial, adapter);
    } catch (error) {
      reader.release(adapter);
      this.#withoutParse(
        id,
        study,
        isBudgetStop(error) ? CHECK_WORDS.parseCapped : CHECK_WORDS.noParse,
      );
      return;
    }
    if (this.#sessions.get(id) !== session || session.done) {
      reader.release(adapter);
      return;
    }
    const check = startCheck({
      study,
      criteriaText: trial.eligibility.criteriaText,
      parsed,
      facts: this.#options.facts(trial.nctId),
      answers: session.answers,
      adapter,
      ...(this.#options.fixedQuestions === true ? { fixedQuestions: true } : {}),
    });
    const running: Running = { check, adapter, pending: null };
    session.running = running;
    await this.#step(id, running, (s) => s.start());
  }

  async #onMessage(message: InboundMessage): Promise<void> {
    const id = message.conversationId;
    const running = this.#sessions.get(id)?.running;
    if (running === undefined || running === null) return;
    const asked = running.check.session.state().pending;
    const choice = message.choice;

    if (choice === "stop") {
      this.#endTrial(
        id,
        recordOf(running.check, running.check.session.stop()),
        CHECK_WORDS.stoppedTrial,
      );
      return;
    }
    if (choice === "confirm" && running.pending !== null) {
      const { text, readings, calls } = running.pending;
      running.pending = null;
      await this.#step(id, running, (s) => s.apply(text, readings, calls));
      return;
    }
    if (choice === "change") {
      running.pending = null;
      this.#offer(id, CHECK_WORDS.choose);
      return;
    }
    if (isTap(choice) && asked !== null) {
      running.pending = null;
      await this.#step(id, running, (s) => s.apply(TAP_WORDS[choice], [tapReading(asked, choice)]));
      return;
    }
    if (this.#options.readTyped === false) {
      this.#offer(id, CHECK_WORDS.tapsOnly);
      return;
    }
    await this.#read(id, running, message.text);
  }

  /** Reads typed text and shows the readings back, to confirm or change. */
  async #read(id: string, running: Running, text: string): Promise<void> {
    running.pending = null;
    let result: CallResult<Reading[]>;
    try {
      result = await running.check.session.preview(text);
    } catch (error) {
      this.#options.reader.release(running.adapter);
      if (!this.#sessions.has(id)) return;
      this.#offer(
        id,
        isBudgetStop(error)
          ? CHECK_WORDS.capped
          : error instanceof ModelError
            ? CHECK_WORDS.unavailableBecause(withStop(reasonOf(error)))
            : CHECK_WORDS.unavailable,
      );
      return;
    }
    this.#options.reader.release(running.adapter);
    if (!this.#sessions.has(id)) return;
    const rules = new Map(running.check.criteria.map((c) => [c.id, c.text]));
    // A reading of a rule the conversation covered, or one never asked, would
    // be ignored when applied, so it isn't shown back for the person to confirm.
    const askable = new Set(
      running.check.session
        .state()
        .progress.filter((p) => p.status !== "from-conversation" && p.status !== "not-raised")
        .map((p) => p.criterionId),
    );
    const readings = result.value.filter(
      (r) => rules.has(r.criterionId) && askable.has(r.criterionId),
    );
    if (readings.length === 0) {
      this.#offer(id, CHECK_WORDS.unclear);
      return;
    }
    running.pending = { text, readings, calls: result.calls };
    const lines = readings.map((r) =>
      CHECK_WORDS.readLine(rules.get(r.criterionId) ?? r.criterionId, READING_WORDS[r.reading]),
    );
    this.#options.transport.deliver(id, [CHECK_WORDS.readAs, ...lines].join("\n"), CONFIRM);
    this.#options.transport.setStatus(id, "idle");
  }

  /**
   * One step of the session, then its question or the trial's end. A step
   * whose question the model couldn't word is taken again with the rule in
   * its own words, which calls no model: the step is atomic, so nothing of
   * the failed try was kept.
   */
  async #step(
    id: string,
    running: Running,
    act: (session: ScreeningSession) => Promise<AgentReply>,
  ): Promise<void> {
    const { reader, transport } = this.#options;
    let reply: AgentReply;
    try {
      reply = await act(running.check.session);
    } catch {
      running.check.session = ScreeningSession.fromState(
        { ...running.check.session.state(), fixedQuestions: true },
        running.adapter,
      );
      try {
        reply = await act(running.check.session);
      } catch {
        // In the trial's own words a step calls no model, so this is a fault,
        // not an outage. The trial is closed where it stands rather than left
        // hanging, and the check goes on.
        reader.release(running.adapter);
        if (this.#sessions.get(id)?.running !== running) return;
        this.#endTrial(
          id,
          recordOf(running.check, running.check.session.stop()),
          CHECK_WORDS.stoppedTrial,
        );
        return;
      }
      if (this.#sessions.has(id)) transport.deliver(id, CHECK_WORDS.ownWords);
    }
    reader.release(running.adapter);
    if (this.#sessions.get(id)?.running !== running) return;
    if (reply.kind === "done") {
      this.#endTrial(id, recordOf(running.check, reply.result), reply.text);
      return;
    }
    transport.deliver(id, reply.text, TAPS);
    transport.setStatus(id, "idle");
  }

  #withoutParse(id: string, study: StudyContext, why: string): void {
    const session = this.#sessions.get(id);
    if (session === undefined || session.done) return;
    const mappings = this.#options.facts(study.nctId)?.mappings ?? [];
    this.#endTrial(id, recordWithoutParse(study, mappings, session.answers), why);
  }

  /** Files a trial's record, says so, and goes on to the next trial. */
  #endTrial(id: string, record: TrialRecord, text: string): void {
    const session = this.#sessions.get(id);
    if (session === undefined) return;
    if (session.running !== null) this.#options.reader.release(session.running.adapter);
    session.records[session.index] = record;
    session.running = null;
    session.index += 1;
    this.#options.transport.deliver(id, text);
    void this.#begin(id);
  }

  #close(id: string, text: string): void {
    const session = this.#sessions.get(id);
    if (session === undefined || session.done) return;
    session.done = true;
    this.#options.transport.deliver(id, text);
    this.#options.transport.setStatus(id, "done");
  }

  #offer(id: string, text: string): void {
    this.#options.transport.deliver(id, text, TAPS);
    this.#options.transport.setStatus(id, "idle");
  }
}

function isTap(choice: string | undefined): choice is Tap {
  return choice === "yes" || choice === "no" || choice === "unknown";
}

function reasonOf(error: unknown): string {
  if (error instanceof ModelError) return error.problems[0] ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

/** A reason, ending in a full stop. */
function withStop(reason: string): string {
  const trimmed = reason.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
