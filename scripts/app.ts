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
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { runDirFor } from "../src/facts/run.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { FakeModelAdapter, ModelError } from "../src/models/index.js";
import { loadConversationSettings } from "../src/questions/settings.js";
import { loadAllTrialFacts, trialsForSearch } from "../src/questions/trials.js";
import { loadZipPoints } from "../src/search/geo.js";
import type { ReaderSource } from "../src/server/finder.js";
import { startServer } from "../src/server/start.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

export const DEFAULT_PORT = 5025;
const WEB_DIR = fileURLToPath(new URL("../dist/web", import.meta.url));

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
 * The reader until Settings exist (step 11 of the plan): scripted, every
 * reply read as "I don't know", with `--fake`; otherwise none, so every reply
 * falls back to the fixed answers.
 */
function provisionalReader(fake: boolean): ReaderSource {
  return {
    current: () => (fake ? "scripted" : "none"),
    name: (key) => (key === "scripted" ? "a scripted reader" : "no model"),
    forConversation: () => {
      if (!fake) throw new ModelError("No model is set up yet", ["Choose an answer instead."]);
      return new FakeModelAdapter([], {
        respond: () => ({ kind: "json", content: { answer: "unknown" } }),
      });
    },
    release: () => {},
  };
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
  const { url } = await startServer({
    port: args.port,
    webDir: WEB_DIR,
    mode: args.fake ? "scripted" : "live",
    info: { snapshotMonth: month, mappingRun: basename(runDir) },
    finder: {
      reader: provisionalReader(args.fake),
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
