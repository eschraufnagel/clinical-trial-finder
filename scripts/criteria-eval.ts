/**
 * Grades the parser on the hand-labelled protocols (spec 0010 §5, item 1).
 *
 *   npm run criteria:eval                          every labelled study, on the local model
 *   npm run criteria:eval -- --model anthropic:claude-haiku-4-5
 *                                                  dry: prints the estimate and exits, unless --spend
 *
 * Wires the runner that came over from the prescreening repository
 * (`evals/runner.ts`), which no command ran here. It parses with the current
 * `SYSTEM_PROMPT`, caches each parse under evals/results/criteria/parses/ by
 * the prompt's identity, and writes a run file beside them. A prompt change is
 * graded by running this once before it and once after.
 */
import { fileURLToPath } from "node:url";
import { labelledStudies, runEval } from "../evals/runner.js";
import {
  createAdapter,
  createLocalAdapter,
  type ModelAdapter,
  ModelError,
  type ModelSpec,
} from "../src/models/index.js";
import { getTrial } from "../src/trials/index.js";
import { parseWorkload } from "./check-parse.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

const RESULTS_DIR = fileURLToPath(new URL("../evals/results/criteria", import.meta.url));

function pct(rate: number | null): string {
  return rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const studies = labelledStudies();

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "parser", spec, workload: parseWorkload(studies.map((id) => getTrial(id))) }],
      scope: `${studies.length} labelled protocols`,
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
  const started = Date.now();
  const run = await runEval(adapter, {
    studies,
    resultsDir: RESULTS_DIR,
    onProgress: (message) => console.log(message),
  });

  const p = run.pooled;
  console.log(`\nPrompt ${run.promptVersion}, ${p.studies} studies graded.`);
  console.log(`  labels ${p.labels}, predictions ${p.predictions}, matched ${p.matched}`);
  console.log(
    `  coverage recall ${pct(p.coverageRecall)}, strict recall ${pct(p.strictRecall)}, precision ${pct(p.precision)}`,
  );
  console.log(
    `  type accuracy ${pct(p.typeAccuracy)}, polarity accuracy ${pct(p.polarityAccuracy)}, merged ${p.merged}`,
  );
  if (run.failed.length > 0) console.log(`  failed: ${run.failed.join(", ")}`);
  console.log(`${((Date.now() - started) / 1000).toFixed(0)} s.`);
  if (plan.kind === "spend") {
    const usd = logSpend("criteria:eval", [{ role: "parser", spec, adapter }], {
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
