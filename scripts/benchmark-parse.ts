/**
 * Parses the trials of the deeper check's NIH-TrialBench pairs (spec 0008 §7.2).
 *
 *   npm run benchmark:parse -- --set dev          dev's trials, on the local model
 *   npm run benchmark:parse -- --set heldout      held-out's, once Gate 2 says so
 *   npm run benchmark:parse -- --set dev --model anthropic:claude-haiku-4-5
 *                                                 dry: prints the estimate and exits, unless --spend
 *
 * Each trial's criteria are the release's own text. Each parse is written to
 * data/criteria/trialbench/<run name>/ the moment it returns, and a rerun reads
 * what's written, so a stopped run resumes. A trial that fails is recorded in
 * failures.json and the run goes on; `latest` names the run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BenchmarkSet, readPairs } from "../evals/benchmark/pairs.js";
import {
  loadTrialBench,
  parseableTrialOf,
  TRIALBENCH_CRITERIA_MONTH,
} from "../evals/benchmark/trialbench.js";
import {
  CRITERIA_DATA_DIR,
  criteriaRunName,
  parseCacheName,
  parseWithCache,
} from "../src/check/parse-cache.js";
import { NORMALIZE_VERSION } from "../src/criteria/normalize.js";
import type { ParseableTrial } from "../src/criteria/prompt.js";
import { PROMPT_VERSION } from "../src/criteria/prompt.js";
import {
  createAdapter,
  createLocalAdapter,
  isBudgetStop,
  type ModelAdapter,
  ModelError,
  type ModelSpec,
} from "../src/models/index.js";
import { parseWorkload } from "./check-parse.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

/** The set's trials, as the parser takes them, in NCT order. */
export function trialsForSet(set: BenchmarkSet): ParseableTrial[] {
  const ids = new Set(
    readPairs()
      .filter((p) => p.set === set)
      .map((p) => p.nctId),
  );
  return loadTrialBench()
    .trials.filter((t) => ids.has(t.nctId))
    .map(parseableTrialOf);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set = args[args.indexOf("--set") + 1] as BenchmarkSet;
  if (!args.includes("--set") || !["dev", "heldout"].includes(set)) {
    console.error("Give --set dev or heldout.");
    process.exitCode = 1;
    return;
  }
  const trials = trialsForSet(set);

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "parser", spec, workload: parseWorkload(trials) }],
      scope: `${trials.length} NIH-TrialBench trials (${set})`,
    });
  } catch (error) {
    console.error(error instanceof ModelError ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  console.log(`${roleLine("parser", spec)}\n`);
  if (plan.kind === "estimate-only" || plan.kind === "refused") {
    console.log(plan.text);
    if (plan.kind === "refused") process.exitCode = 1;
    return;
  }

  const adapter: ModelAdapter =
    plan.kind === "spend" ? createAdapter(spec, { budget: plan.budget }) : createLocalAdapter(spec);
  const name = criteriaRunName(adapter.descriptor.model, PROMPT_VERSION, NORMALIZE_VERSION);
  const root = join(CRITERIA_DATA_DIR, TRIALBENCH_CRITERIA_MONTH);
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const failuresPath = join(dir, "failures.json");
  const failures: Record<string, string> = existsSync(failuresPath)
    ? (JSON.parse(readFileSync(failuresPath, "utf8")) as Record<string, string>)
    : {};

  const todo = trials.filter(
    (t) => !existsSync(join(dir, parseCacheName(t.nctId, adapter.descriptor))),
  );
  console.log(
    `Run ${name}: ${trials.length - todo.length} of ${trials.length} already parsed; parsing ${todo.length}.`,
  );
  const started = Date.now();
  for (const trial of todo) {
    const t0 = Date.now();
    try {
      const { parsed } = await parseWithCache(trial, adapter, dir);
      delete failures[trial.nctId];
      const secs = (Date.now() - t0) / 1000;
      console.log(
        `${trial.nctId}  ${String(trial.eligibility.criteriaText.length).padStart(6)} chars  ${secs.toFixed(1).padStart(6)} s  ${parsed.criteria.length} criteria, ${parsed.rejected.length} rejected`,
      );
    } catch (error) {
      if (isBudgetStop(error)) {
        console.error(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
      failures[trial.nctId] = error instanceof Error ? error.message : String(error);
      console.error(`${trial.nctId}  failed: ${failures[trial.nctId]?.split("\n")[0]}`);
    }
    writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`, "utf8");
  }
  writeFileSync(join(root, "latest"), `${name}\n`, "utf8");
  console.log(`\n${todo.length} trials in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  if (plan.kind === "spend") {
    const usd = logSpend("benchmark:parse", [{ role: "parser", spec, adapter }], {
      batch: flags.batch,
    });
    console.log(`Spent about $${usd.toFixed(2)}.`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
