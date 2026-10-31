import type { Fact } from "../facts/types.js";
import {
  type AppChoice,
  BudgetPool,
  createAppAdapter,
  isBudgetStop,
  type LocalModels,
  listLocalModels,
  type ModelAdapter,
  ModelError,
  redact,
  type Spent,
  spentBy,
  withLocalSettings,
} from "../models/index.js";
import { readReply } from "../questions/read.js";
import type { ReaderSource } from "./finder.js";
import { choiceKey, hostedOf, logAppSpend, type SettingsStore } from "./settings.js";

/**
 * Where the page's reader comes from (spec 0004 §8.3). Every adapter the
 * running app builds is built here, from what a person chose and saved in
 * Settings, through `createAppAdapter`, which always wraps a hosted model in
 * the budget. `tests/boundary.test.ts` holds that this is the only app file
 * that names it. Adapted from the prescreening repository's.
 *
 * A conversation gets its own adapter and its own budget pool, so its cap
 * holds across its readings, and it keeps the model it started on.
 */

export interface SettingsModelsOptions {
  store: SettingsStore;
  env?: NodeJS.ProcessEnv;
  /** Injected so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

/** The reader as Settings chose it. */
export function settingsReader(options: SettingsModelsOptions): ReaderSource {
  const { store } = options;
  return {
    current: () => choiceKey(store.current()),
    name: (key) => nameOf(key, store),
    measured: (key) => store.measured(hostedOf(key)?.model ?? store.current().model),
    hosted: (key) => hostedOf(key)?.name ?? null,
    forConversation: (key) => new ConversationModel(key, options),
    release: (adapter) => {
      if (adapter instanceof ConversationModel) adapter.release();
    },
  };
}

/** "Anthropic · claude-haiku-4-5", or the local model's name. */
function nameOf(key: string, store: SettingsStore): string {
  const hosted = hostedOf(key);
  return hosted === null
    ? `the local model, ${store.current().model}`
    : `${hosted.name} · ${hosted.model}`;
}

const NOTHING: Spent = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  usd: 0,
  servedModels: [],
};

/** A conversation's limit for calls: 16 questions, with room to read some again. Its dollar limit is the person's, in Settings. */
const CONVERSATION_MAX_CALLS = 48;
/** The connection test: one call. */
const CHECK_BUDGET = { maxCalls: 1, maxUsd: 0.01 };

/**
 * One conversation's reader. Built on its first call, so a conversation
 * with no key saved still starts and falls back to the fixed answers, and
 * rebuilt after a stop at its cap, keeping its pool, so raising the cap in
 * Settings lets it continue with what it has spent still counted.
 */
export class ConversationModel implements ModelAdapter {
  readonly #key: string;
  readonly #options: SettingsModelsOptions;
  readonly #pool = new BudgetPool();
  #inner: ModelAdapter | undefined;
  #capUsd = 0;
  /** What was last logged, and from which adapter: each one counts from zero. */
  #logged: { from: ModelAdapter | undefined; spent: Spent } = { from: undefined, spent: NOTHING };

  constructor(key: string, options: SettingsModelsOptions) {
    this.#key = key;
    this.#options = options;
  }

  get descriptor(): ModelAdapter["descriptor"] {
    return this.#build().descriptor;
  }

  /**
   * A failure comes back with every saved key taken out, since the page may
   * show its reason. A stop at the cap logs what was spent and lets the next
   * call rebuild under the current cap.
   */
  async complete(request: Parameters<ModelAdapter["complete"]>[0]) {
    try {
      return await this.#build().complete(request);
    } catch (error) {
      if (isBudgetStop(error)) {
        this.release();
        this.#inner = undefined;
        throw error;
      }
      throw this.#redacted(error);
    }
  }

  #redacted(error: unknown): ModelError {
    const saved = this.#options.store.saved();
    const secrets = [
      ...Object.values(saved.keys).filter((k): k is string => k !== undefined),
      ...(saved.local.apiKey === undefined ? [] : [saved.local.apiKey]),
    ];
    const clean = (t: string) => secrets.reduce((text, secret) => redact(text, secret), t);
    return error instanceof ModelError
      ? new ModelError(clean(error.message), error.problems.map(clean))
      : new ModelError("The model failed", [
          clean(error instanceof Error ? error.message : String(error)),
        ]);
  }

  /** Logs what was spent since the last log, if anything: after each reading, and at the end. */
  release(): void {
    const inner = this.#inner;
    const spent = inner === undefined ? undefined : spentBy(inner);
    if (spent === undefined) return;
    const before = this.#logged.from === inner ? this.#logged.spent : NOTHING;
    const added: Spent = {
      calls: spent.calls - before.calls,
      inputTokens: spent.inputTokens - before.inputTokens,
      outputTokens: spent.outputTokens - before.outputTokens,
      cacheWriteTokens: spent.cacheWriteTokens - before.cacheWriteTokens,
      cacheReadTokens: spent.cacheReadTokens - before.cacheReadTokens,
      usd: spent.usd - before.usd,
      servedModels: spent.servedModels,
    };
    if (added.calls <= 0) return;
    logAppSpend(this.#options.store.dir, "reader", this.#key, added);
    this.#logged = { from: inner, spent };
  }

  #build(): ModelAdapter {
    const { store } = this.#options;
    if (choiceKey(store.current()) !== this.#key) {
      throw new ModelError("This conversation can't continue on another model", [
        `It started on ${nameOf(this.#key, store)}. Choose it in Settings to continue, or start over.`,
      ]);
    }
    if (this.#inner === undefined) {
      this.#capUsd = store.caps().conversationUsd;
      this.#inner = createAppAdapter(store.current(), store.saved(), {
        budget: { maxCalls: CONVERSATION_MAX_CALLS, maxUsd: this.#capUsd },
        pool: this.#pool,
        thinking: false,
        ...envAndFetch(this.#options),
      });
    }
    return this.#inner;
  }
}

/** A made-up question for the connection test: nothing about anyone's health. */
const CHECK_FACT: Fact = {
  id: "check",
  question: "Do you have a cat?",
  answers: [
    { id: "yes", words: "Yes" },
    { id: "no", words: "No" },
  ],
  whoKnows: "patient",
  cancerTypes: "all",
};
const CHECK_REPLY = "Yes, a tabby called Biscuit.";

export type ConnectionResult =
  | { ok: true; usd: number; servedModel: string; read: string }
  | { ok: false; problem: string };

/**
 * Settings' Test: one reading of a made-up reply, through the chosen model,
 * capped at a cent. It answers whether the model reads a plain reply onto
 * the right answer, which is what "the key works" has to mean here. A
 * provider's error comes back with the key taken out.
 */
export async function testConnection(
  options: SettingsModelsOptions,
  choice: AppChoice,
): Promise<ConnectionResult> {
  const { store } = options;
  const saved = store.saved();
  const secrets = [
    ...Object.values(saved.keys).filter((k): k is string => k !== undefined),
    ...(saved.local.apiKey === undefined ? [] : [saved.local.apiKey]),
  ];
  let adapter: ModelAdapter | undefined;
  try {
    adapter = createAppAdapter(choice, saved, {
      budget: CHECK_BUDGET,
      thinking: false,
      ...envAndFetch(options),
    });
    const reading = await readReply(CHECK_FACT, CHECK_REPLY, adapter);
    if (reading.answer !== "yes") {
      return {
        ok: false,
        problem: `It answered, but read "${CHECK_REPLY}" as ${reading.answer === "unknown" ? "not knowing" : reading.answer}${reading.rejected === undefined ? "" : ` (${reading.rejected})`}.`,
      };
    }
    const spent = spentBy(adapter);
    return {
      ok: true,
      usd: spent?.usd ?? 0,
      servedModel: spent?.servedModels[0] ?? adapter.descriptor.model,
      read: CHECK_REPLY,
    };
  } catch (error) {
    const text =
      error instanceof ModelError
        ? [error.message, ...error.problems].join(": ")
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, problem: secrets.reduce((t, s) => redact(t, s), text) };
  } finally {
    const spent = adapter === undefined ? undefined : spentBy(adapter);
    if (spent !== undefined && spent.calls > 0) {
      logAppSpend(store.dir, "check", choiceKey(choice), spent);
    }
  }
}

/** The local server's models, with the saved address and key over the environment. */
export function localModels(options: SettingsModelsOptions): Promise<LocalModels> {
  const saved = options.store.saved();
  return listLocalModels(
    withLocalSettings(options.env ?? process.env, saved.local),
    options.fetchImpl,
  );
}

function envAndFetch(options: SettingsModelsOptions): {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
} {
  return {
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  };
}
