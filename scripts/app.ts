/**
 * Runs the page on this machine (slice 0004).
 *
 *   npm run app                          the page, on the model chosen in Settings, http://127.0.0.1:5025
 *   npm run app -- --fake                a scripted reader: no model is called
 *   npm run app -- --port 5030
 *   npm run app -- --settings-dir <dir>  keep Settings and keys there instead of local/
 *
 * `npm run app` builds the page first (`vite build`), then runs this. Use
 * made-up answers.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPatients } from "../evals/questions/patients.js";
import { runDirFor } from "../src/facts/run.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import {
  admittedModels,
  catalogEntry,
  estimate,
  FakeModelAdapter,
  PROVIDERS,
  type Provider,
} from "../src/models/index.js";
import { READER_PROMPT_VERSION } from "../src/questions/prompt.js";
import { loadConversationSettings } from "../src/questions/settings.js";
import { loadAllTrialFacts, trialsForSearch } from "../src/questions/trials.js";
import { loadZipPoints } from "../src/search/geo.js";
import type { ReaderSource } from "../src/server/finder.js";
import { localModels, settingsReader, testConnection } from "../src/server/models.js";
import { type Estimates, type Measurement, SettingsStore } from "../src/server/settings.js";
import { startServer } from "../src/server/start.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import { READS_DIR, workloadFor } from "./questions-read.js";

export const DEFAULT_PORT = 5025;
const WEB_DIR = fileURLToPath(new URL("../dist/web", import.meta.url));
const LOCAL_DIR = fileURLToPath(new URL("../local", import.meta.url));
/** A conversation's readings: the intake and the follow-up budget. */
const READS_PER_CONVERSATION = 16;

export interface AppArgs {
  port: number;
  fake: boolean;
  settingsDir: string | undefined;
}

export function parseAppArgs(args: readonly string[]): AppArgs {
  const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const port = Number(value("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("--port is a whole number from 1024 to 65535.");
  return { port, fake: args.includes("--fake"), settingsDir: value("--settings-dir") };
}

/** A committed reads file's run record and items, as much of them as this file reads. */
interface ReadsOnDisk {
  run: { model: string; adapter: string; promptVersion: string; schema?: "enforced" };
  items: {
    factId: string;
    kind: string;
    reply: string;
    expected: string;
    answer: string;
    rejected?: string;
  }[];
  failures: Record<string, string>;
}

/** Every reads file in `dir` made with the current prompt. */
function readsOnCurrentPrompt(dir: string): { name: string; file: ReadsOnDisk }[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      name,
      file: JSON.parse(readFileSync(join(dir, name), "utf8")) as ReadsOnDisk,
    }))
    .filter(({ file }) => file.run.promptVersion === READER_PROMPT_VERSION);
}

/**
 * The scripted reader for `--fake` (spec 0004 §9.4): a reply is read as the
 * local model read it in the committed reading runs on the current prompt,
 * found by the question and the reply's exact text; anything else reads as
 * unknown. Typing a made-up patient's reply gives the model's own recorded
 * reading of it, with no model running.
 *
 * The local model's files only, by their run's adapter (slice 0006). Before,
 * every file on the prompt was read, Claude Haiku 4.5's included, and the
 * local model's readings won only because their file sorted later.
 */
export function scriptedReader(
  vocabulary: ReturnType<typeof loadFactVocabulary>,
  dir: string = READS_DIR,
): ReaderSource {
  const questions = new Map(vocabulary.facts.map((f) => [f.id, f.question]));
  const readings = new Map<string, string>();
  for (const { file } of readsOnCurrentPrompt(dir)) {
    if (file.run.adapter !== "omlx") continue;
    for (const item of file.items)
      readings.set(`${questions.get(item.factId)}\n${item.reply}`, item.answer);
  }
  return {
    current: () => "scripted",
    name: () => "a scripted reader",
    measured: () => false,
    forConversation: () =>
      new FakeModelAdapter([], {
        respond: (request) => {
          const question = /^Question: (.*)$/m.exec(request.user)?.[1];
          const reply = /^Reply: (".*")$/m.exec(request.user)?.[1];
          const text = reply === undefined ? "" : (JSON.parse(reply) as string);
          const answer = readings.get(`${question}\n${text}`) ?? "unknown";
          return { kind: "json", content: { answer } };
        },
      }),
    release: () => {},
  };
}

/**
 * What each committed held-out reading run measured (spec 0004 §8.5), by
 * the model each file records: how many replies it could read, how exactly
 * it read those that stated an answer, and how often it invented one. Read
 * here because `src/` doesn't import `evals/`, and the files are the record.
 *
 * Only a run of the request the app would send now counts (slice 0006): the
 * current prompt, and the schema enforced exactly when the catalog says that
 * model's adapter enforces it. 0004's Claude Haiku 4.5 run, made without the
 * schema, no longer measures what the app sends. Two such runs for one model
 * is an error, not a silent pick.
 */
export function measuredModels(dir: string = READS_DIR): Measurement[] {
  const sends = (run: ReadsOnDisk["run"]) =>
    (PROVIDERS as readonly string[]).includes(run.adapter)
      ? (catalogEntry(run.adapter as Provider, run.model)?.schema ?? null)
      : null;
  const runs = readsOnCurrentPrompt(dir).filter(
    ({ name, file }) =>
      name.startsWith("heldout-") && (file.run.schema ?? null) === sends(file.run),
  );
  const models = runs.map(({ file }) => file.run.model);
  const twice = models.find((m, i) => models.indexOf(m) !== i);
  if (twice !== undefined)
    throw new Error(
      `Two held-out reading runs measure ${twice} as the app would ask it. Keep one.`,
    );
  return runs.map(({ file }) => {
    const read = file.items.filter((i) => i.rejected === undefined);
    const known = read.filter((i) => i.kind === "says");
    const dontKnow = read.filter((i) => i.kind !== "says");
    const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
    return {
      model: file.run.model,
      readable: share(read.length, file.items.length + Object.keys(file.failures).length),
      exact: share(known.filter((i) => i.answer === i.expected).length, known.length),
      invented: share(dontKnow.filter((i) => i.answer !== "unknown").length, dontKnow.length),
    };
  });
}

/**
 * What one conversation's readings are expected to cost on each admitted
 * model: the dev patients' average read, priced as the paid runs are, times
 * the readings a conversation makes. It overestimates, as those do.
 */
export function conversationEstimates(
  vocabulary: ReturnType<typeof loadFactVocabulary>,
): Estimates {
  const workload = workloadFor(loadPatients("dev", vocabulary, loadZipPoints()), vocabulary);
  const perRead = {
    expected: {
      calls: READS_PER_CONVERSATION,
      inputTokens:
        (workload.expected.inputTokens / workload.expected.calls) * READS_PER_CONVERSATION,
      outputTokens:
        (workload.expected.outputTokens / workload.expected.calls) * READS_PER_CONVERSATION,
    },
    perCallCeiling: workload.perCallCeiling,
  };
  const out: Estimates = {};
  for (const provider of PROVIDERS) {
    for (const model of admittedModels(provider)) {
      const entry = catalogEntry(provider, model);
      if (entry !== undefined)
        out[`${provider}:${model}`] = estimate(entry, perRead, {
          maxCalls: READS_PER_CONVERSATION,
          batch: false,
        }).expected.usd;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseAppArgs(process.argv.slice(2));
  const snapshot = loadSnapshot();
  const month = snapshot.manifest.month;
  const runDir = runDirFor(month, undefined);
  const vocabulary = loadFactVocabulary();
  const settings = loadConversationSettings(vocabulary);
  const zips = loadZipPoints();
  const facts = loadAllTrialFacts(runDir);
  const interventions = new Map(
    snapshot.trials.map((t) => [t.nctId, t.interventions.map((i) => i.name)]),
  );
  const store = new SettingsStore(args.settingsDir ?? LOCAL_DIR, {
    measured: measuredModels(),
    estimates: conversationEstimates(vocabulary),
  });
  const models = { store };
  const { url } = await startServer({
    port: args.port,
    webDir: WEB_DIR,
    mode: args.fake ? "scripted" : "live",
    info: { snapshotMonth: month, mappingRun: basename(runDir) },
    settings: {
      store,
      test: args.fake
        ? async () => ({ ok: true, usd: 0, servedModel: "a scripted reader", read: "made-up" })
        : (choice) => testConnection(models, choice),
      localModels: () => localModels(models),
    },
    finder: {
      reader: args.fake ? scriptedReader(vocabulary) : settingsReader(models),
      trialsFor: (search) => trialsForSearch(search, snapshot, zips, (id) => facts.get(id)),
      interventions: (id) => interventions.get(id) ?? [],
      vocabulary,
      settings,
      snapshotMonth: month,
    },
  });
  console.log(`The page is at ${url}. Use made-up answers. Ctrl-C stops it.`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
