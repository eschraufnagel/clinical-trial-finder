/**
 * Checks the NIH-TrialBench pairs against clinicians' labels (spec 0008 §7.6).
 *
 *   npm run benchmark:check -- --dev              dev's 14 pairs, both arms, on the local model
 *   npm run benchmark:check                       held-out's 56, once: refused when a held-out result exists
 *   npm run benchmark:check -- --arm full         one arm only (Gate 2's option)
 *   npm run benchmark:check -- --check [--dev]    regrade the latest result from its transcripts; no model
 *   npm run benchmark:check -- --check --result <path>   regrade a named result instead
 *   npm run benchmark:check -- --parts <path>     print a result's parts measure (0009), from its transcripts; no model
 *   npm run benchmark:check -- --dev --model anthropic:claude-haiku-4-5
 *                                                 dry: prints the estimate and exits, unless --spend
 *
 * Each pair's transcript, per arm, is written to
 * evals/results/benchmark/check/runs/<set>-<hash>/ the moment it finishes, and
 * a rerun skips what's written, so a stopped run resumes. A pair that stops on
 * an error goes to failures.json and is tried again on a rerun. The hash covers
 * the pairs, the accounts, the reasons, the parse run, both prompts' versions,
 * the model, the reasoning mode and the check's revision.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BenchmarkCheckResult,
  benchmarkRegradeProblems,
  scoreBenchmark,
} from "../evals/benchmark/check-result.js";
import type { BenchmarkTranscript } from "../evals/benchmark/check-run.js";
import { type Arm, checkBenchmarkPair } from "../evals/benchmark/check-run.js";
import {
  ACCOUNTS_DIR,
  accountPath,
  type BenchmarkSet,
  PAIRS_PATH,
  REASONS_PATH,
  readPairs,
  readReasons,
} from "../evals/benchmark/pairs.js";
import { folderSha256 } from "../evals/benchmark/sources.js";
import {
  loadTrialBench,
  parseableTrialOf,
  TRIALBENCH_CRITERIA_MONTH,
} from "../evals/benchmark/trialbench.js";
import { fileSha256, runHash } from "../evals/check/result.js";
import { CHECK_REVISION } from "../evals/check/run.js";
import { SUMMARY_SIMULATOR_VERSION } from "../evals/participant/prompt.js";
import { nextRunFile } from "../evals/run-file.js";
import { findParse, latestCriteriaRun } from "../src/check/parse-cache.js";
import {
  createAdapter,
  createLocalAdapter,
  isBudgetStop,
  type ModelAdapter,
  ModelError,
  type ModelSpec,
  monthStamp,
} from "../src/models/index.js";
import { PROMPT_VERSION as AGENT_PROMPT_VERSION } from "../src/screening/prompts.js";
import { evalWorkload, latestResult } from "./check-eval.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const RESULTS_DIR = fileURLToPath(
  new URL("../evals/results/benchmark/check", import.meta.url),
);

/** An account's text: the file without its first line, which names its source. */
export function accountText(file: string): string {
  return file.split("\n").slice(1).join("\n").trim();
}

function readTranscripts(dir: string): BenchmarkTranscript[] {
  return readdirSync(dir)
    .filter((n) => /^nci-\d+-NCT\d+-(full|account)\.json$/.test(n))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as BenchmarkTranscript);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set: BenchmarkSet = args.includes("--dev") ? "dev" : "heldout";
  const resultsDir = set === "dev" ? join(RESULTS_DIR, "dev") : RESULTS_DIR;
  const armArg = args.includes("--arm") ? args[args.indexOf("--arm") + 1] : undefined;
  if (armArg !== undefined && armArg !== "full" && armArg !== "account") {
    console.error("--arm is full or account.");
    process.exitCode = 1;
    return;
  }
  const arms: Arm[] = armArg === undefined ? ["full", "account"] : [armArg];

  const { vignettes, trials } = loadTrialBench();
  const pairs = readPairs();
  const reasons = readReasons();
  const byId = new Map(trials.map((t) => [t.nctId, t]));
  const textOf = (id: string) => byId.get(id)?.criteriaText ?? "";
  const checksums = {
    pairsSha256: fileSha256(PAIRS_PATH),
    accountsSha256: folderSha256(ACCOUNTS_DIR),
    reasonsSha256: fileSha256(REASONS_PATH),
  };

  if (args.includes("--parts")) {
    const path = args[args.indexOf("--parts") + 1];
    if (path === undefined || !existsSync(path)) {
      console.error("--parts takes a result file.");
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(path, "utf8")) as BenchmarkCheckResult;
    const set = pairs.filter((p) => p.set === committed.set);
    const { parts } = scoreBenchmark(
      readTranscripts(join(ROOT, committed.transcripts)),
      set,
      committed.arms,
      reasons,
      textOf,
    );
    console.log(JSON.stringify(parts.byArm, null, 2));
    return;
  }

  if (args.includes("--check")) {
    const named = args.includes("--result") ? args[args.indexOf("--result") + 1] : undefined;
    const path = named ?? latestResult(resultsDir);
    if (path === undefined) {
      console.error(`No result in ${resultsDir} to check.`);
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(path, "utf8")) as BenchmarkCheckResult;
    const problems = benchmarkRegradeProblems(
      committed,
      readTranscripts(join(ROOT, committed.transcripts)),
      pairs,
      reasons,
      textOf,
      checksums,
    );
    if (problems.length > 0) {
      console.error(`${path} doesn't match a regrade: ${problems.join("; ")}.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${path} matches a regrade of its transcripts, row for row.`);
    return;
  }
  if (set === "heldout" && latestResult(RESULTS_DIR) !== undefined) {
    console.error(
      "A held-out result exists. Held-out is checked once; regrade it with --check, or rerun dev with --dev.",
    );
    process.exitCode = 1;
    return;
  }

  const parseDir = latestCriteriaRun(TRIALBENCH_CRITERIA_MONTH);
  if (parseDir === undefined) {
    console.error("No parse run: run `npm run benchmark:parse -- --set <set>` first.");
    process.exitCode = 1;
    return;
  }
  const mine = pairs.filter((p) => p.set === set);
  const work = arms.flatMap((arm) => mine.map((pair) => ({ pair, arm })));

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  try {
    const flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "agent and participant", spec, workload: evalWorkload(work.length) }],
      scope: `${mine.length} pairs × ${arms.length} arm(s) (${set})`,
    });
  } catch (error) {
    console.error(error instanceof ModelError ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  console.log(`${roleLine("agent and participant", spec)}\n`);
  if (plan.kind === "estimate-only" || plan.kind === "refused") {
    console.log(plan.text);
    if (plan.kind === "refused") process.exitCode = 1;
    return;
  }
  // Reasoning off for all three roles, as `check:eval` runs them (0007, step 12).
  const adapter: ModelAdapter =
    plan.kind === "spend"
      ? createAdapter(spec, { budget: plan.budget, thinking: false })
      : createLocalAdapter(spec, { thinking: false });

  const parseRun = relative(join(ROOT, "data", "criteria"), parseDir);
  const hash = runHash([
    checksums.pairsSha256,
    checksums.accountsSha256,
    checksums.reasonsSha256,
    AGENT_PROMPT_VERSION,
    SUMMARY_SIMULATOR_VERSION,
    parseRun,
    adapter.descriptor.model,
    `thinking ${adapter.descriptor.thinking ?? "default"}`,
    `check ${CHECK_REVISION}`,
  ]);
  const runsDir = join(RESULTS_DIR, "runs", `${set}-${hash}`);
  mkdirSync(runsDir, { recursive: true });
  const fileOf = (p: { patient: string; nctId: string }, arm: Arm) =>
    join(runsDir, `${p.patient}-${p.nctId}-${arm}.json`);
  const failuresPath = join(runsDir, "failures.json");
  const failures: Record<string, string> = existsSync(failuresPath)
    ? (JSON.parse(readFileSync(failuresPath, "utf8")) as Record<string, string>)
    : {};
  const summaries = new Map(vignettes.map((v) => [v.patient, v.summary]));
  const textFor = (patient: string, arm: Arm) =>
    arm === "full"
      ? (summaries.get(patient) ?? "")
      : accountText(readFileSync(accountPath(patient), "utf8"));

  const todo = work.filter(({ pair, arm }) => !existsSync(fileOf(pair, arm)));
  console.log(
    `Run ${set}-${hash}: ${work.length - todo.length} of ${work.length} checks done; running ${todo.length}.`,
  );
  let stopped = false;
  for (const { pair, arm } of todo) {
    const bench = byId.get(pair.nctId);
    if (bench === undefined) throw new Error(`No trial ${pair.nctId}`);
    const t0 = Date.now();
    try {
      const transcript = await checkBenchmarkPair({
        pair,
        arm,
        text: textFor(pair.patient, arm),
        trial: parseableTrialOf(bench),
        parsed: findParse(parseDir, pair.nctId, bench.criteriaText),
        agent: adapter,
        participant: adapter,
        fidelity: adapter,
      });
      const label = `${pair.patient} ${pair.nctId} ${arm}`;
      if (transcript.error === undefined) {
        writeFileSync(fileOf(pair, arm), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
        delete failures[label];
      } else {
        failures[label] = transcript.error;
      }
      writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`, "utf8");
      const questions = transcript.transcript.filter((x) => x.kind === "question").length;
      console.log(
        `${label.padEnd(30)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(5)} s  ${transcript.parse}, ${questions} asked, ${transcript.record.counts.mayNotFit} may not fit` +
          `${transcript.error === undefined ? "" : `, stopped: ${transcript.error.split("\n")[0]}`}`,
      );
    } catch (error) {
      if (isBudgetStop(error)) {
        console.error(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
        stopped = true;
        break;
      }
      throw error;
    }
  }
  if (plan.kind === "spend") {
    const usd = logSpend("benchmark:check", [{ role: "agent and participant", spec, adapter }], {
      batch: false,
    });
    console.log(`Spent about $${usd.toFixed(2)}.`);
  }
  const transcripts = readTranscripts(runsDir).filter((t) => arms.includes(t.arm));
  if (stopped || transcripts.length < work.length) {
    console.log(
      `${transcripts.length} of ${work.length} checks have transcripts; rerun to finish.`,
    );
    return;
  }

  const scored = scoreBenchmark(transcripts, mine, arms, reasons, textOf);
  const parsedOne = transcripts.find((t) => t.parse === "parsed");
  const parse =
    parsedOne === undefined
      ? undefined
      : findParse(parseDir, parsedOne.nctId, textOf(parsedOne.nctId));
  const result: BenchmarkCheckResult = {
    version: 1,
    set,
    arms,
    ...checksums,
    parseRun,
    parser: parse?.run ?? null,
    run: {
      agent: transcripts.find((t) => t.run !== null)?.run ?? null,
      participant: {
        ...adapter.descriptor,
        promptVersion: SUMMARY_SIMULATOR_VERSION,
        timestamp: monthStamp(),
      },
    },
    transcripts: relative(ROOT, runsDir),
    ...scored,
  };
  mkdirSync(resultsDir, { recursive: true });
  const out = join(resultsDir, nextRunFile(resultsDir, hash));
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${relative(ROOT, out)}.`);
  console.log(
    JSON.stringify(
      { byArm: result.byArm, compared: result.compared, parts: result.parts?.byArm },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
