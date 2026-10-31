/**
 * Measures the deeper check on the made-up patients (spec 0007 §7.3, §7.4).
 *
 *   npm run check:eval -- --dev               dev's 9 pairs, on the local model
 *   npm run check:eval                        held-out's 50, once: refused when a held-out result exists
 *   npm run check:eval -- --check [--dev]     regrade the latest result from its transcripts; no model
 *   npm run check:eval -- --dev --model anthropic:claude-haiku-4-5
 *                                             dry: prints the estimate and exits, unless --spend
 *
 * Each pair's transcript is written to evals/results/check/runs/<set>-<hash>/
 * the moment it finishes, and a rerun skips pairs already written, so a
 * stopped run resumes. The result is written when every pair has a
 * transcript. The hash covers the labels, the agent's and the participant's
 * prompts, the parse run, the link's threshold and the model, so a change to
 * any of them is a new run, never a silent mix.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  conversationsFor,
  loadCheckContext,
  PAIR_LABELS_PATH,
  picksOf,
  picksProblems,
  readCommittedQuestionsResult,
  readPairLabels,
} from "../evals/check/pairs.js";
import {
  type CheckEvalResult,
  fileSha256,
  regradeProblems,
  runHash,
  scoreTranscripts,
} from "../evals/check/result.js";
import { checkPair } from "../evals/check/run.js";
import type { PairTranscript } from "../evals/check/transcript.js";
import { PATIENT_SIMULATOR_VERSION } from "../evals/participant/prompt.js";
import type { PatientSet } from "../evals/questions/patients.js";
import { patientsSha256 } from "../evals/questions/result.js";
import { nextRunFile } from "../evals/run-file.js";
import { LINK_THRESHOLD } from "../src/check/link.js";
import { findParse, latestCriteriaRun } from "../src/check/parse-cache.js";
import { readTrialFacts } from "../src/facts/run.js";
import {
  createAdapter,
  createLocalAdapter,
  isBudgetStop,
  type ModelAdapter,
  ModelError,
  type ModelSpec,
  monthStamp,
  type Workload,
} from "../src/models/index.js";
import { PROMPT_VERSION as AGENT_PROMPT_VERSION } from "../src/screening/prompts.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const RESULTS_DIR = fileURLToPath(new URL("../evals/results/check", import.meta.url));

/** Rough: about 25 questions a pair, three calls each (ask, read, participant) and a fidelity read. */
export function evalWorkload(pairs: number): Workload {
  const calls = pairs * 25 * 4;
  return {
    expected: { calls, inputTokens: calls * 1_500, outputTokens: calls * 200 },
    perCallCeiling: { inputTokens: 6_000, outputTokens: 2_048 },
  };
}

export function latestResult(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const names = readdirSync(dir)
    .filter((n) => /^\d+-[0-9a-f]+\.json$/.test(n))
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const last = names.at(-1);
  return last === undefined ? undefined : join(dir, last);
}

function readTranscripts(dir: string): PairTranscript[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as PairTranscript);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set: PatientSet = args.includes("--dev") ? "dev" : "heldout";
  const resultsDir = set === "dev" ? join(RESULTS_DIR, "dev") : RESULTS_DIR;
  const ctx = loadCheckContext();
  const text = new Map(ctx.snapshot.trials.map((t) => [t.nctId, t.eligibility.criteriaText]));
  const textOf = (id: string) => text.get(id) ?? "";
  const labels = readPairLabels();
  const labelsSha256 = fileSha256(PAIR_LABELS_PATH);

  if (args.includes("--check")) {
    const path = latestResult(resultsDir);
    if (path === undefined) {
      console.error(`No result in ${resultsDir} to check.`);
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(path, "utf8")) as CheckEvalResult;
    const problems = regradeProblems(
      committed,
      readTranscripts(join(ROOT, committed.transcripts)),
      labels,
      labelsSha256,
      textOf,
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

  const conversations = conversationsFor(set, ctx);
  const picks = conversations.flatMap((c) => picksOf(c, set));
  const pickProblems = picksProblems(picks, readCommittedQuestionsResult());
  if (pickProblems.length > 0) {
    console.error(`The picks don't match the committed result:\n  ${pickProblems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const parseDir = latestCriteriaRun(ctx.snapshot.manifest.month);
  if (parseDir === undefined) {
    console.error("No parse run: run `npm run check:parse -- --set <set>` first.");
    process.exitCode = 1;
    return;
  }

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "agent and participant", spec, workload: evalWorkload(picks.length) }],
      scope: `${picks.length} pairs (${set})`,
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
  const adapter: ModelAdapter =
    plan.kind === "spend" ? createAdapter(spec, { budget: plan.budget }) : createLocalAdapter(spec);

  const parseRun = relative(join(ROOT, "data", "criteria"), parseDir);
  const hash = runHash([
    labelsSha256,
    AGENT_PROMPT_VERSION,
    PATIENT_SIMULATOR_VERSION,
    parseRun,
    String(LINK_THRESHOLD),
    adapter.descriptor.model,
  ]);
  const runsDir = join(RESULTS_DIR, "runs", `${set}-${hash}`);
  mkdirSync(runsDir, { recursive: true });
  const fileOf = (p: { patient: string; nctId: string }) =>
    join(runsDir, `${p.patient}-${p.nctId}.json`);
  const todo = picks.filter((p) => !existsSync(fileOf(p)));
  console.log(
    `Run ${set}-${hash}: ${picks.length - todo.length} of ${picks.length} pairs done; checking ${todo.length}.`,
  );

  let stopped = false;
  for (const pick of todo) {
    const conversation = conversations.find((c) => c.patient.id === pick.patient);
    const trial = ctx.snapshot.trials.find((t) => t.nctId === pick.nctId);
    if (conversation === undefined || trial === undefined)
      throw new Error(`No ${pick.patient} ${pick.nctId}`);
    const t0 = Date.now();
    try {
      const transcript = await checkPair({
        pick,
        conversation,
        trial,
        facts: readTrialFacts(ctx.runDir, pick.nctId),
        parsed: findParse(parseDir, pick.nctId, trial.eligibility.criteriaText),
        vocabulary: ctx.vocabulary,
        settings: ctx.settings,
        agent: adapter,
        participant: adapter,
        fidelity: adapter,
      });
      writeFileSync(fileOf(pick), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
      const questions = transcript.transcript.filter((x) => x.kind === "question").length;
      console.log(
        `${pick.patient} ${pick.nctId}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(5)} s  ` +
          `${transcript.parse}, ${Object.keys(transcript.carried).length} carried, ${questions} asked` +
          `${transcript.error === undefined ? "" : `, stopped: ${transcript.error}`}`,
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
    const usd = logSpend("check:eval", [{ role: "agent and participant", spec, adapter }], {
      batch: false,
    });
    console.log(`Spent about $${usd.toFixed(2)}.`);
  }
  const transcripts = readTranscripts(runsDir);
  if (stopped || transcripts.length < picks.length) {
    console.log(
      `${transcripts.length} of ${picks.length} pairs have transcripts; rerun to finish.`,
    );
    return;
  }

  const { rows, summary } = scoreTranscripts(
    transcripts,
    { ...labels, pairs: labels.pairs.filter((p) => p.set === set) },
    textOf,
  );
  const parsed = transcripts.find((t) => t.parse === "parsed");
  const parse =
    parsed === undefined ? undefined : findParse(parseDir, parsed.nctId, textOf(parsed.nctId));
  const result: CheckEvalResult = {
    version: 1,
    set,
    labelsSha256,
    patientsSha256: patientsSha256(set),
    snapshot: { month: ctx.snapshot.manifest.month, sha256: ctx.snapshot.manifest.sha256 },
    mappingRun: relative(join(ROOT, "data", "facts"), ctx.runDir),
    parseRun,
    parser: parse?.run ?? null,
    linkThreshold: LINK_THRESHOLD,
    run: {
      agent: transcripts.find((t) => t.run !== null)?.run ?? null,
      participant: {
        ...adapter.descriptor,
        promptVersion: PATIENT_SIMULATOR_VERSION,
        timestamp: monthStamp(),
      },
    },
    transcripts: relative(ROOT, runsDir),
    rows,
    summary,
  };
  mkdirSync(resultsDir, { recursive: true });
  const out = join(resultsDir, nextRunFile(resultsDir, hash));
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${relative(ROOT, out)}.`);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
