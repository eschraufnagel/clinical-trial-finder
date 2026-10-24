/**
 * Maps trials' eligibility rules onto the fact vocabulary (spec 0002 §3.4).
 *
 *   npm run facts:map -- --set dev                 the 10 dev trials, on the local model
 *   npm run facts:map -- --set heldout             the 30 held-out trials
 *   npm run facts:map -- --set candidates          all NSCLC candidates; writes a manifest when it finishes
 *   npm run facts:map -- --set dev --limit 3       only the first 3 not yet mapped, for timing
 *   npm run facts:map -- --set candidates --model anthropic:claude-haiku-4-5 [--batch]
 *                                                  dry: prints the estimate and exits, unless --spend
 *
 * Each trial is written to data/facts/<month>/<run name>/<NCT ID>.json the
 * moment it returns, and a rerun skips trials already written, so a stopped
 * run resumes. A trial that fails is recorded in failures.json and the run
 * goes on. The run name is the model, the prompt version and the vocabulary,
 * so a changed prompt is a new directory, never a silent overwrite.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FACT_LABELS_DIR, type FactLabels } from "../evals/facts/labels.js";
import { mapTrialFacts } from "../src/facts/map.js";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "../src/facts/prompt.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { factsFor, loadFactVocabulary } from "../src/facts/vocabulary.js";
import {
  createAdapter,
  createLocalAdapter,
  isBudgetStop,
  type ModelAdapter,
  ModelError,
  type ModelSpec,
  tokensFor,
  type Workload,
} from "../src/models/index.js";
import { loadVocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";
import { candidateIds } from "./facts-candidates.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

export const FACTS_DATA_DIR = fileURLToPath(new URL("../data/facts", import.meta.url));

/** About 15 mappings of 40 tokens each: an expectation for the estimate, not a cap. */
const EXPECTED_OUTPUT_TOKENS = 600;
const MAX_OUTPUT_TOKENS = 8_192;

export type MapSet = "dev" | "heldout" | "candidates";

export function runName(model: string, promptVersion: string, vocabularySha256: string): string {
  const slug = model
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${promptVersion.slice(0, 8)}-${vocabularySha256.slice(0, 8)}`;
}

/** The trials of a set, in the order they're mapped. */
export function trialsFor(
  set: MapSet,
  trials: readonly SnapshotTrial[],
  labels: readonly Pick<FactLabels, "nctId" | "set">[],
): SnapshotTrial[] {
  const byId = new Map(trials.map((t) => [t.nctId, t]));
  const ids =
    set === "candidates"
      ? candidateIds(trials, loadVocabulary("nsclc"))
      : labels.filter((l) => l.set === set).map((l) => l.nctId);
  return ids.map((id) => {
    const t = byId.get(id);
    if (t === undefined) throw new Error(`${id} isn't in the snapshot`);
    return t;
  });
}

/** The prompts this run would send, as tokens, for the estimate. */
export function workloadFor(
  trials: readonly SnapshotTrial[],
  vocabulary: FactVocabulary,
): Workload {
  const facts = factsFor(vocabulary, "nsclc");
  const inputs = trials.map((t) =>
    tokensFor(SYSTEM_PROMPT + buildUserPrompt(t, t.eligibility.criteriaText, facts)),
  );
  return {
    expected: {
      calls: trials.length,
      inputTokens: inputs.reduce((a, b) => a + b, 0),
      outputTokens: trials.length * EXPECTED_OUTPUT_TOKENS,
    },
    perCallCeiling: { inputTokens: Math.max(0, ...inputs), outputTokens: MAX_OUTPUT_TOKENS },
  };
}

/** Trials not yet written in the run directory. */
export function remaining(trials: readonly SnapshotTrial[], dir: string): SnapshotTrial[] {
  return trials.filter((t) => !existsSync(join(dir, `${t.nctId}.json`)));
}

export interface Manifest {
  runName: string;
  set: "candidates";
  run: Record<string, unknown>;
  candidates: number;
  mapped: number;
  failed: number;
  rejectedMappings: number;
  mappings: number;
  seconds: number;
}

export function buildManifest(
  dir: string,
  name: string,
  candidates: readonly string[],
  seconds: number,
): Manifest {
  let mapped = 0;
  let rejected = 0;
  let mappings = 0;
  let run: Record<string, unknown> = {};
  for (const id of candidates) {
    const path = join(dir, `${id}.json`);
    if (!existsSync(path)) continue;
    const t = JSON.parse(readFileSync(path, "utf8")) as {
      mappings: unknown[];
      rejected: unknown[];
      run: Record<string, unknown>;
    };
    mapped++;
    mappings += t.mappings.length;
    rejected += t.rejected.length;
    run = t.run;
  }
  return {
    runName: name,
    set: "candidates",
    run,
    candidates: candidates.length,
    mapped,
    failed: candidates.length - mapped,
    rejectedMappings: rejected,
    mappings,
    seconds: Math.round(seconds),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set = args[args.indexOf("--set") + 1] as MapSet;
  if (!args.includes("--set") || !["dev", "heldout", "candidates"].includes(set)) {
    console.error("Give --set dev, heldout or candidates.");
    process.exitCode = 1;
    return;
  }
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : undefined;

  const { manifest: snapshot, trials: all } = loadSnapshot();
  const vocabulary = loadFactVocabulary();
  const labels = readdirSync(FACT_LABELS_DIR)
    .filter((n) => /^NCT\d{8}\.json$/.test(n))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(FACT_LABELS_DIR, n), "utf8")) as FactLabels);
  const trials = trialsFor(set, all, labels);

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "mapper", spec, workload: workloadFor(trials, vocabulary) }],
      scope: `${trials.length} trials (${set})`,
    });
  } catch (error) {
    console.error(error instanceof ModelError ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  console.log(`${roleLine("mapper", spec)}\n`);
  if (plan.kind === "estimate-only" || plan.kind === "refused") {
    console.log(plan.text);
    if (plan.kind === "refused") process.exitCode = 1;
    return;
  }

  const adapter: ModelAdapter =
    plan.kind === "spend" ? createAdapter(spec, { budget: plan.budget }) : createLocalAdapter(spec);
  const name = runName(adapter.descriptor.model, PROMPT_VERSION, vocabulary.sha256);
  const dir = join(FACTS_DATA_DIR, snapshot.month, name);
  mkdirSync(dir, { recursive: true });
  const failuresPath = join(dir, "failures.json");
  const failures: Record<string, string> = existsSync(failuresPath)
    ? (JSON.parse(readFileSync(failuresPath, "utf8")) as Record<string, string>)
    : {};

  const todo = remaining(trials, dir).slice(0, limitArg);
  console.log(
    `Run ${name}: ${trials.length - remaining(trials, dir).length} of ${trials.length} already mapped; mapping ${todo.length}.`,
  );
  const started = Date.now();
  let chars = 0;
  let stopped = false;
  for (const trial of todo) {
    const t0 = Date.now();
    try {
      const facts = await mapTrialFacts(trial, vocabulary, adapter, {
        snapshotMonth: snapshot.month,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      writeFileSync(
        join(dir, `${trial.nctId}.json`),
        `${JSON.stringify(facts, null, 2)}\n`,
        "utf8",
      );
      delete failures[trial.nctId];
      chars += trial.eligibility.criteriaText.length;
      const secs = (Date.now() - t0) / 1000;
      console.log(
        `${trial.nctId}  ${String(trial.eligibility.criteriaText.length).padStart(6)} chars  ${secs.toFixed(1).padStart(6)} s  ${facts.mappings.length} mappings, ${facts.rejected.length} rejected`,
      );
    } catch (error) {
      if (isBudgetStop(error)) {
        console.error(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
        stopped = true;
        break;
      }
      failures[trial.nctId] = error instanceof Error ? error.message : String(error);
      console.error(`${trial.nctId}  failed: ${failures[trial.nctId]?.split("\n")[0]}`);
    }
    writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`, "utf8");
  }

  const seconds = (Date.now() - started) / 1000;
  if (chars > 0) {
    console.log(
      `\n${todo.length} trials in ${seconds.toFixed(0)} s: ${((seconds / chars) * 1000).toFixed(1)} s per 1,000 characters.`,
    );
  }
  if (plan.kind === "spend") {
    const usd = logSpend("facts:map", [{ role: "mapper", spec, adapter }], { batch: flags.batch });
    console.log(`Spent about $${usd.toFixed(2)}.`);
  }
  if (set === "candidates" && !stopped && remaining(trials, dir).length === 0) {
    const manifest = buildManifest(
      dir,
      name,
      trials.map((t) => t.nctId),
      seconds,
    );
    writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Wrote the manifest: ${manifest.mapped} mapped, ${manifest.failed} failed.`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
