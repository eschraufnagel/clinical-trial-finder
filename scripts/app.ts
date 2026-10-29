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

async function main(): Promise<void> {
  const args = parseAppArgs(process.argv.slice(2));
  const snapshot = loadSnapshot();
  const runDir = runDirFor(snapshot.manifest.month, undefined);
  const { url } = await startServer({
    port: args.port,
    webDir: WEB_DIR,
    mode: args.fake ? "scripted" : "live",
    info: { snapshotMonth: snapshot.manifest.month, mappingRun: basename(runDir) },
  });
  console.log(`The page is at ${url}. Use made-up answers. Ctrl-C stops it.`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
