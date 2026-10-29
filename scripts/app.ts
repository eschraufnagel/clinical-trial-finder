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
  ModelError,
  PROVIDERS,
} from "../src/models/index.js";
import { loadConversationSettings } from "../src/questions/settings.js";
import { loadAllTrialFacts, trialsForSearch } from "../src/questions/trials.js";
import { loadZipPoints } from "../src/search/geo.js";
import type { ReaderSource } from "../src/server/finder.js";
import { localModels, settingsReader, testConnection } from "../src/server/models.js";
import { type Estimates, SettingsStore } from "../src/server/settings.js";
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

/**
 * The scripted reader for `--fake`, until step 13 of the plan reads from the
 * committed readings: every reply read as "I don't know".
 */
function provisionalReader(fake: boolean): ReaderSource {
  return {
    current: () => (fake ? "scripted" : "none"),
    name: (key) => (key === "scripted" ? "a scripted reader" : "no model"),
    measured: () => false,
    forConversation: () => {
      if (!fake) throw new ModelError("No model is set up yet", ["Choose an answer instead."]);
      return new FakeModelAdapter([], {
        respond: () => ({ kind: "json", content: { answer: "unknown" } }),
      });
    },
    release: () => {},
  };
}

/**
 * The models a committed held-out reading run measured (spec 0004 §8.5), by
 * the model name each file records. Read here because `src/` doesn't import
 * `evals/`, and the files are the record.
 */
export function measuredModels(dir: string = READS_DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.startsWith("heldout-") && name.endsWith(".json"))
    .map(
      (name) =>
        (JSON.parse(readFileSync(join(dir, name), "utf8")) as { run: { model: string } }).run.model,
    );
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
      reader: args.fake ? provisionalReader(true) : settingsReader(models),
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
