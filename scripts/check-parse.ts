/**
 * Parses the picked trials for slice 0007's measurement (spec 0007 §2.2).
 *
 *   npm run check:parse -- --set dev          dev's trials, on the local model
 *   npm run check:parse -- --set heldout      held-out's, once Gate 1 says so
 *   npm run check:parse -- --set dev --model anthropic:claude-haiku-4-5
 *                                             dry: prints the estimate and exits, unless --spend
 *
 * The picked trials are each patient's first three on the conversation's
 * short list, checked against the committed questions result first. Each
 * parse is written to data/criteria/<month>/<run name>/ the moment it returns,
 * and a rerun reads what's written, so a stopped run resumes. A trial that
 * fails is recorded in failures.json and the run goes on. The run name is the
 * model, the parser's prompt and its normalize version; `latest` names it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  conversationsFor,
  loadCheckContext,
  picksOf,
  picksProblems,
  readCommittedQuestionsResult,
} from "../evals/check/pairs.js";
import type { PatientSet } from "../evals/questions/patients.js";
import {
  CRITERIA_DATA_DIR,
  criteriaRunName,
  parseCacheName,
  parseWithCache,
} from "../src/check/parse-cache.js";
import { NORMALIZE_VERSION, normalize } from "../src/criteria/normalize.js";
import {
  buildUserPrompt,
  type ParseableTrial,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from "../src/criteria/prompt.js";
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
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

/** About 30 criteria of 120 tokens: an expectation for the estimate, not a cap. */
const EXPECTED_OUTPUT_TOKENS = 4_000;
/** The parser's own default. */
const MAX_OUTPUT_TOKENS = 16_384;

/** The prompts this run would send, as tokens, for the estimate. */
export function parseWorkload(trials: readonly ParseableTrial[]): Workload {
  const inputs = trials.map((t) =>
    tokensFor(SYSTEM_PROMPT + buildUserPrompt(t, normalize(t.eligibility.criteriaText).text)),
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set = args[args.indexOf("--set") + 1] as PatientSet;
  if (!args.includes("--set") || !["dev", "heldout"].includes(set)) {
    console.error("Give --set dev or heldout.");
    process.exitCode = 1;
    return;
  }

  const ctx = loadCheckContext();
  const picks = conversationsFor(set, ctx).flatMap((c) => picksOf(c, set));
  const problems = picksProblems(picks, readCommittedQuestionsResult());
  if (problems.length > 0) {
    console.error(`The picks don't match the committed result:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const byId = new Map(ctx.snapshot.trials.map((t) => [t.nctId, t]));
  const trials = [...new Set(picks.map((p) => p.nctId))].map((id) => {
    const t = byId.get(id);
    if (t === undefined) throw new Error(`${id} isn't in the snapshot`);
    return t;
  });

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "parser", spec, workload: parseWorkload(trials) }],
      scope: `${trials.length} trials (${set})`,
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
  const month = ctx.snapshot.manifest.month;
  const name = criteriaRunName(adapter.descriptor.model, PROMPT_VERSION, NORMALIZE_VERSION);
  const dir = join(CRITERIA_DATA_DIR, month, name);
  mkdirSync(dir, { recursive: true });
  const failuresPath = join(dir, "failures.json");
  const failures: Record<string, string> = existsSync(failuresPath)
    ? (JSON.parse(readFileSync(failuresPath, "utf8")) as Record<string, string>)
    : {};

  const written = (t: SnapshotTrial) =>
    existsSync(join(dir, parseCacheName(t.nctId, adapter.descriptor)));
  const todo = trials.filter((t) => !written(t));
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
  writeFileSync(join(CRITERIA_DATA_DIR, month, "latest"), `${name}\n`, "utf8");
  console.log(`\n${todo.length} trials in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  if (plan.kind === "spend") {
    const usd = logSpend("check:parse", [{ role: "parser", spec, adapter }], {
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
