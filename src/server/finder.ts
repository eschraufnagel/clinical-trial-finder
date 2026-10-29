import { randomUUID } from "node:crypto";
import type { FactVocabulary } from "../facts/types.js";
import { isBudgetStop } from "../models/budget.js";
import { type ModelAdapter, ModelError } from "../models/types.js";
import {
  answer,
  type ConversationState,
  changeAnswer,
  current,
  nextStep,
  startConversation,
  stopNow,
} from "../questions/conversation.js";
import { type Reading, readReply } from "../questions/read.js";
import { type TrialInput, UNKNOWN } from "../questions/select.js";
import { type ConversationSettings, skippedFacts } from "../questions/settings.js";
import type { ConversationSearch } from "../questions/trials.js";
import { UnknownZipError } from "../search/geo.js";
import { describeOrder, type OrderView } from "../shortlist/explain.js";
import { oncologistSheet, type SheetView } from "../shortlist/sheet.js";
import type { Choice, InboundMessage, MessageTransport } from "../transport/types.js";

/**
 * The conversation service (spec 0004 §4): one person's search, questions and
 * answers, driven over a `MessageTransport`. It doesn't know the other end is
 * a web page.
 *
 * Each question offers its fixed answers and "I don't know" as choices, one
 * tap away, and takes free text too. Free text is read by the model, and the
 * reading is shown back: **nothing typed enters the answers until the person
 * confirms it**. A picked answer needs no confirm, since the person picked the
 * answer's own words. If the reading can't be used, or the model can't be
 * reached, the question falls back to its choices, saying why, so the
 * conversation works with no model at all. The reader is expected to have
 * taken any key out of what it throws (`src/server/models.ts` does).
 *
 * Sessions live in memory: a reload continues one, a restart forgets it.
 */

/** Where the reader's model comes from: the one in Settings, or a scripted one. */
export interface ReaderSource {
  /** The key a new conversation records, such as `omlx` or `anthropic:claude-haiku-4-5`. */
  current(): string;
  /** The model's name, for "Read by …" on the page. */
  name(key: string): string;
  /** Whether a committed held-out reading run measured the model. */
  measured(key: string): boolean;
  /** The hosted provider's name a key sends replies to, or null for this machine. */
  hosted?(key: string): string | null;
  /** The adapter one conversation reads with, for the model it started on. Throws if none can be built. */
  forConversation(key: string): ModelAdapter;
  /** A conversation ended or was cleared: log what it spent. */
  release(adapter: ModelAdapter): void;
}

export interface FinderOptions {
  transport: MessageTransport;
  reader: ReaderSource;
  /** A search's trials, with their mappings. Throws `UnknownZipError` for a ZIP not in the gazetteer. */
  trialsFor: (search: ConversationSearch) => TrialInput[];
  /** A trial's interventions, from the snapshot. */
  interventions?: (nctId: string) => readonly string[];
  vocabulary: FactVocabulary;
  settings: ConversationSettings;
  snapshotMonth: string;
  newId?: () => string;
}

/** What the person enters before the questions: everything the search needs. */
export interface SearchForm {
  zip: string;
  radiusMiles: number | null;
  age: number;
  sex: "female" | "male";
}

export type StartOutcome = { ok: true; id: string } | { ok: false; field: string; error: string };

/** One answer, as the page lists it under "Your answers". */
export interface AnswerView {
  factId: string;
  question: string;
  /** The person's own words, when they typed. */
  said: string | null;
  /** An answer id, or `unknown`. */
  answer: string;
  /** What Change offers: the fact's answers and "I don't know". */
  choices: Choice[];
}

export interface FinderView {
  stopped: boolean;
  order: OrderView;
  sheet: SheetView;
  answers: AnswerView[];
  /** The reader's model, for "Read by …". */
  model: string;
  /** Whether a committed held-out reading run measured it. */
  measured: boolean;
  /** The hosted provider replies go to, or null when they stay on this machine. */
  hosted: string | null;
}

interface Pending {
  factId: string;
  text: string;
  reading: Reading;
}

interface Session {
  search: SearchForm;
  state: ConversationState;
  said: Record<string, string>;
  /** The reading waiting for the person to confirm it. */
  pending: Pending | null;
  /** The model the conversation started on, as `ReaderSource.current()` gave it. */
  key: string;
  adapter: ModelAdapter | null;
  /** Why no adapter could be built, said when a reply falls back. */
  noAdapter: string | null;
  /** The closing message has been sent. */
  done: boolean;
}

export const CONFIRM: readonly Choice[] = [
  { id: "confirm", label: "That's right" },
  { id: "change", label: "Change it" },
];

export const WORDS = {
  intro:
    'A few questions everyone is asked come first, then some chosen for you. Answer in your own words, or choose an answer. "I don\'t know" is always fine: it never takes a trial off your list.',
  readAs: (words: string) => `I read that as: ${words}.`,
  readUnknown: "I read that as: you don't know.",
  closest: "Which is closest?",
  unclear: "I couldn't tell from that. Which is closest?",
  unavailable: "I couldn't read that just now. Which is closest?",
  capped:
    "This conversation has reached its cost cap in Settings, so I can't read replies. Which is closest?",
  done: "That's all the questions. Your list of trials to ask about is ready.",
  stopped: "No more questions. Your list of trials to ask about is ready.",
} as const;

const RADII: readonly (number | null)[] = [25, 50, 100, 250, null];

export class FinderService {
  readonly #options: FinderOptions;
  readonly #sessions = new Map<string, Session>();

  constructor(options: FinderOptions) {
    this.#options = options;
    options.transport.onMessage((m) => {
      void this.#onMessage(m);
    });
  }

  /** Starts a conversation from the search form, or says which field is wrong. */
  start(form: unknown): StartOutcome {
    const checked = checkForm(form);
    if (!checked.ok) return checked;
    const search = checked.form;
    let trials: TrialInput[];
    try {
      trials = this.#options.trialsFor({ cancerType: "nsclc", ...search });
    } catch (error) {
      if (error instanceof UnknownZipError)
        return { ok: false, field: "zip", error: error.message };
      throw error;
    }
    const { vocabulary, settings, reader, transport } = this.#options;
    const state = startConversation({
      trials,
      vocabulary,
      settings,
      cancerType: "nsclc",
      sex: search.sex,
    });
    const key = reader.current();
    let adapter: ModelAdapter | null = null;
    let noAdapter: string | null = null;
    try {
      adapter = reader.forConversation(key);
    } catch (error) {
      noAdapter = error instanceof Error ? error.message : String(error);
    }
    const id = this.#options.newId?.() ?? randomUUID();
    this.#sessions.set(id, {
      search,
      state,
      said: {},
      pending: null,
      key,
      adapter,
      noAdapter,
      done: false,
    });
    transport.open(id, [], "working");
    transport.deliver(id, WORDS.intro);
    this.#askNext(id);
    return { ok: true, id };
  }

  /** The short list, the sheet and the answers, as they stand. */
  view(id: string): FinderView | undefined {
    const session = this.#sessions.get(id);
    if (session === undefined) return undefined;
    const { vocabulary, settings, interventions, snapshotMonth } = this.#options;
    const so = current(session.state);
    const skipped = skippedFacts(settings, session.search.sex);
    const input = {
      order: so.order,
      orderName: settings.order,
      shortlistSize: settings.shortlistSize,
      profile: so.profile,
      said: session.said,
      vocabulary,
      cancerType: "nsclc",
      skipped,
      ...(interventions === undefined ? {} : { interventions }),
    };
    const facts = new Map(vocabulary.facts.map((f) => [f.id, f]));
    return {
      stopped: so.stop !== null,
      order: describeOrder(input),
      sheet: oncologistSheet({ ...input, asked: so.steps.map((s) => s.factId), snapshotMonth }),
      answers: so.steps.map((step) => ({
        factId: step.factId,
        question: facts.get(step.factId)?.question ?? step.factId,
        said: session.said[step.factId] ?? null,
        answer: so.profile[step.factId] ?? UNKNOWN,
        choices: this.#answerChoices(step.factId),
      })),
      model: this.#options.reader.name(session.key),
      measured: this.#options.reader.measured(session.key),
      hosted: this.#options.reader.hosted?.(session.key) ?? null,
    };
  }

  /**
   * Changes a confirmed answer, from the fixed answers (spec 0004 §1.6). The
   * order follows; no more questions are chosen.
   */
  changeAnswer(id: string, factId: string, answerId: unknown): "ok" | "unknown" | "refused" {
    const session = this.#sessions.get(id);
    if (session === undefined) return "unknown";
    if (typeof answerId !== "string") return "refused";
    try {
      changeAnswer(session.state, factId, answerId);
    } catch {
      return "refused";
    }
    delete session.said[factId];
    this.#finish(id, WORDS.stopped);
    return "ok";
  }

  /** "Show me the list now": no more questions. */
  stop(id: string): boolean {
    const session = this.#sessions.get(id);
    if (session === undefined) return false;
    stopNow(session.state);
    this.#finish(id, WORDS.stopped);
    return true;
  }

  /** Start over: the conversation is forgotten. */
  remove(id: string): boolean {
    const session = this.#sessions.get(id);
    if (session === undefined) return false;
    if (session.adapter !== null && !session.done) this.#options.reader.release(session.adapter);
    this.#sessions.delete(id);
    this.#options.transport.close(id);
    return true;
  }

  async #onMessage(message: InboundMessage): Promise<void> {
    const id = message.conversationId;
    const session = this.#sessions.get(id);
    if (session === undefined) return;
    const next = nextStep(session.state);
    if ("stop" in next) return;
    const factId = next.factId;

    if (message.choice === "confirm" && session.pending !== null) {
      const { text, reading } = session.pending;
      this.#commit(id, factId, reading.answer, text);
      return;
    }
    if (message.choice === "change") {
      session.pending = null;
      this.#offer(id, WORDS.closest, factId);
      return;
    }
    if (message.choice !== undefined) {
      this.#commit(id, factId, message.choice, null);
      return;
    }
    await this.#read(id, factId, message.text);
  }

  async #read(id: string, factId: string, text: string): Promise<void> {
    const session = this.#sessions.get(id);
    const fact = this.#options.vocabulary.facts.find((f) => f.id === factId);
    if (session === undefined || fact === undefined) return;
    session.pending = null;
    if (session.adapter === null) {
      this.#offer(id, `${WORDS.unavailable} ${session.noAdapter ?? ""}`.trim(), factId);
      return;
    }
    let reading: Reading;
    try {
      reading = await readReply(fact, text, session.adapter);
    } catch (error) {
      if (!this.#sessions.has(id)) return;
      const why = error instanceof ModelError ? (error.problems[0] ?? "") : "";
      this.#offer(
        id,
        isBudgetStop(error) ? WORDS.capped : `${WORDS.unavailable} ${why}`.trim(),
        factId,
      );
      return;
    }
    if (!this.#sessions.has(id)) return;
    if (reading.rejected !== undefined) {
      this.#offer(id, WORDS.unclear, factId);
      return;
    }
    session.pending = { factId, text, reading };
    const words =
      reading.answer === UNKNOWN
        ? WORDS.readUnknown
        : WORDS.readAs(fact.answers.find((a) => a.id === reading.answer)?.words ?? reading.answer);
    this.#options.transport.deliver(id, words, CONFIRM);
    this.#options.transport.setStatus(id, "idle");
  }

  #commit(id: string, factId: string, answerId: string, text: string | null): void {
    const session = this.#sessions.get(id);
    if (session === undefined) return;
    try {
      answer(session.state, factId, answerId);
    } catch {
      this.#offer(id, WORDS.closest, factId);
      return;
    }
    session.pending = null;
    if (text !== null) session.said[factId] = text;
    this.#askNext(id);
  }

  #askNext(id: string): void {
    const session = this.#sessions.get(id);
    if (session === undefined) return;
    const next = nextStep(session.state);
    if ("stop" in next) {
      this.#finish(id, WORDS.done);
      return;
    }
    const fact = this.#options.vocabulary.facts.find((f) => f.id === next.factId);
    this.#options.transport.deliver(
      id,
      fact?.question ?? next.factId,
      this.#answerChoices(next.factId),
    );
    this.#options.transport.setStatus(id, "idle");
  }

  #offer(id: string, text: string, factId: string): void {
    this.#options.transport.deliver(id, text, this.#answerChoices(factId));
    this.#options.transport.setStatus(id, "idle");
  }

  /** Sends the closing message once, and logs what the reader spent. */
  #finish(id: string, text: string): void {
    const session = this.#sessions.get(id);
    if (session === undefined || session.done) return;
    session.pending = null;
    session.done = true;
    this.#options.transport.deliver(id, text);
    this.#options.transport.setStatus(id, "done");
    if (session.adapter !== null) this.#options.reader.release(session.adapter);
  }

  #answerChoices(factId: string): Choice[] {
    const fact = this.#options.vocabulary.facts.find((f) => f.id === factId);
    return [
      ...(fact?.answers ?? []).map((a) => ({ id: a.id, label: a.words })),
      { id: UNKNOWN, label: "I don't know" },
    ];
  }
}

/** The search form, checked field by field. */
export function checkForm(
  form: unknown,
): { ok: true; form: SearchForm } | { ok: false; field: string; error: string } {
  const f = (typeof form === "object" && form !== null ? form : {}) as Record<string, unknown>;
  const zip = f["zip"];
  if (typeof zip !== "string" || !/^\d{5}$/.test(zip.trim()))
    return { ok: false, field: "zip", error: "A ZIP code is five digits." };
  const radius = f["radiusMiles"];
  if (!RADII.includes(radius as number | null))
    return { ok: false, field: "radiusMiles", error: "Choose a distance from the list." };
  const age = f["age"];
  if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 120)
    return { ok: false, field: "age", error: "Age is a whole number of years." };
  const sex = f["sex"];
  if (sex !== "female" && sex !== "male")
    return { ok: false, field: "sex", error: "Choose female or male, as the trials ask." };
  return { ok: true, form: { zip: zip.trim(), radiusMiles: radius as number | null, age, sex } };
}
