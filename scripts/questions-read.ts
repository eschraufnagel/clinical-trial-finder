/**
 * Reads every patient's replies onto their facts' answers (spec 0003 §7.2).
 *
 *   npm run questions:read -- --set dev           every (patient, fact) pair on dev, on the local model
 *   npm run questions:read -- --set heldout       the same for held-out
 *   npm run questions:read -- --set dev --model anthropic:claude-haiku-4-5
 *                                                 dry: prints the estimate and exits, unless --spend
 *
 * Writes evals/results/questions/reads/<set>-<model>-<prompt>.json as it
 * goes, and a rerun skips the pairs already read and retries the ones that
 * failed, so a stopped run resumes. A changed prompt is a new file, never an
 * overwrite, and so is a run whose adapter enforces the reader's schema
 * (slice 0006): its name ends `-schema`. `npm run questions:eval -- --reads <file>` then answers the
 * conversations from these readings, with no further model calls.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPatients, type Patient, type PatientSet } from "../evals/questions/patients.js";
import {
  gradeReads,
  pairsFor,
  type ReadGrade,
  type ReadItem,
  type ReadsFile,
} from "../evals/questions/reads.js";
import { patientsSha256 } from "../evals/questions/result.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import type { Provider } from "../src/models/catalog.js";
import {
  createAdapter,
  createLocalAdapter,
  isBudgetStop,
  type ModelAdapter,
  type ModelDescriptor,
  ModelError,
  type ModelSpec,
  monthStamp,
  tokensFor,
  type Workload,
} from "../src/models/index.js";
import { keyAppearsIn } from "../src/models/keys.js";
import {
  buildReaderPrompt,
  READER_PROMPT_VERSION,
  READER_SYSTEM_PROMPT,
} from "../src/questions/prompt.js";
import { readReply } from "../src/questions/read.js";
import { loadZipPoints } from "../src/search/geo.js";
import { logSpend, planPaidRun, readModelFlags, roleLine } from "./lib/model-flags.js";

export const READS_DIR = fileURLToPath(
  new URL("../evals/results/questions/reads", import.meta.url),
);

const MAX_OUTPUT_TOKENS = 64;

/**
 * One file per set, model, prompt and request: a changed prompt is a new file,
 * and so is a run whose schema was enforced (slice 0006), so it never resumes
 * or overwrites a run made without one. The vocabulary is named inside.
 */
export function readsPath(
  set: PatientSet,
  run: Pick<ModelDescriptor, "model" | "schema">,
  dir: string = READS_DIR,
): string {
  const slug = run.model
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  const shape = run.schema === "enforced" ? "-schema" : "";
  return join(dir, `${set}-${slug}-${READER_PROMPT_VERSION.slice(0, 8)}${shape}.json`);
}

export function workloadFor(patients: readonly Patient[], vocabulary: FactVocabulary): Workload {
  const facts = new Map(vocabulary.facts.map((f) => [f.id, f]));
  const inputs = pairsFor(patients, vocabulary).map((p) => {
    const fact = facts.get(p.factId);
    return tokensFor(
      READER_SYSTEM_PROMPT + (fact === undefined ? "" : buildReaderPrompt(fact, p.reply)),
    );
  });
  return {
    expected: {
      calls: inputs.length,
      inputTokens: inputs.reduce((a, b) => a + b, 0),
      outputTokens: inputs.length * 12,
    },
    perCallCeiling: { inputTokens: Math.max(0, ...inputs), outputTokens: MAX_OUTPUT_TOKENS },
  };
}

/**
 * Reads every pair not already read in `path`, writing the file after each
 * one. Returns the file, and whether a budget stopped it.
 */
/**
 * Why a reading failed, on one line: the error's title and its reasons
 * (for a provider, its status and message). The reads file is committed,
 * so a text holding a secret is replaced, never written.
 */
export function failureText(error: unknown, holdsSecret?: (text: string) => boolean): string {
  // A ModelError's message is its title, then a line per reason ("  - HTTP 429 …").
  const text = (error instanceof Error ? error.message : String(error))
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
  return holdsSecret?.(text) === true
    ? "failed; the error's text held the key, so it isn't kept"
    : text;
}

export async function readAll(input: {
  set: PatientSet;
  patients: readonly Patient[];
  vocabulary: FactVocabulary;
  adapter: ModelAdapter;
  path: string;
  patientsSha256: string;
  log?: (line: string) => void;
  /** Whether a failure's text holds a secret, such as the provider's key. Such a text isn't written. */
  holdsSecret?: (text: string) => boolean;
}): Promise<{ file: ReadsFile; stopped: boolean }> {
  const { vocabulary, adapter, path } = input;
  const log = input.log ?? (() => {});
  const file: ReadsFile = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as ReadsFile)
    : {
        version: 1,
        set: input.set,
        run: {
          ...adapter.descriptor,
          promptVersion: READER_PROMPT_VERSION,
          timestamp: monthStamp(),
        },
        vocabularySha256: vocabulary.sha256,
        patientsSha256: input.patientsSha256,
        items: [],
        failures: {},
      };
  if (file.patientsSha256 !== input.patientsSha256 || file.vocabularySha256 !== vocabulary.sha256)
    throw new Error(
      `${path} was read from other patients or another vocabulary. Move it aside first.`,
    );

  const done = new Set(file.items.map((i) => `${i.patient}:${i.factId}`));
  const facts = new Map(vocabulary.facts.map((f) => [f.id, f]));
  const save = () => writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  let stopped = false;
  for (const pair of pairsFor(input.patients, vocabulary)) {
    const key = `${pair.patient}:${pair.factId}`;
    if (done.has(key)) continue;
    const fact = facts.get(pair.factId);
    if (fact === undefined) continue;
    try {
      const reading = await readReply(fact, pair.reply, adapter, {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      const item: ReadItem = {
        ...pair,
        answer: reading.answer,
        ...(reading.rejected === undefined ? {} : { rejected: reading.rejected }),
      };
      file.items.push(item);
      delete file.failures[key];
      log(
        `${key.padEnd(34)} ${pair.expected.padEnd(24)} ${item.answer}${item.answer === item.expected ? "" : "   <-"}`,
      );
    } catch (error) {
      if (isBudgetStop(error)) {
        log(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
        stopped = true;
        save();
        break;
      }
      file.failures[key] = failureText(error, input.holdsSecret);
      log(`${key.padEnd(34)} failed: ${file.failures[key]}`);
    }
    save();
  }
  return { file, stopped };
}

const percent = (x: number | null) => (x === null ? "-" : `${(100 * x).toFixed(1)}%`);

/**
 * The grade, led by the share of every pair read at all (slice 0006's
 * measure): neither failed nor rejected, out of the pairs read and failed.
 */
export function formatGrade(grade: ReadGrade, failed = 0): string {
  const r = (label: string, x: ReadGrade["known"]["exact"]) =>
    `  ${label.padEnd(22)} ${String(x.n).padStart(4)} of ${String(x.of).padEnd(4)} ${percent(x.share).padStart(6)}  (95% ${x.interval === null ? "-" : `${percent(x.interval[0])} to ${percent(x.interval[1])}`})`;
  const pairs = grade.known.items + grade.dontKnow.items + failed;
  const readAtAll = grade.known.items + grade.dontKnow.items - grade.rejected;
  return [
    `Read at all: ${readAtAll} of ${pairs} ${percent(pairs === 0 ? null : readAtAll / pairs)} (failed ${failed}, rejected ${grade.rejected})`,
    `Known replies, ${grade.known.items}:`,
    r("exact", grade.known.exact),
    r("lost (read unknown)", grade.known.lost),
    r("wrong answer", grade.known.wrong),
    `Don't-know replies, ${grade.dontKnow.items}:`,
    r("invented, all", grade.dontKnow.invented),
    r("invented, specific", grade.dontKnow.inventedSpecific),
    r("invented, phrases", grade.dontKnow.inventedPhrase),
    `Readings rejected as unusable: ${grade.rejected}`,
    ...(grade.inventions.length === 0 ? [] : ["", "Invented:"]),
    ...grade.inventions.map(
      (i) => `  ${i.patient} ${i.factId} -> ${i.answer}: ${JSON.stringify(i.reply)}`,
    ),
    ...(grade.wrongs.length === 0 ? [] : ["", "Wrong:"]),
    ...grade.wrongs.map(
      (i) => `  ${i.patient} ${i.factId} ${i.expected} -> ${i.answer}: ${JSON.stringify(i.reply)}`,
    ),
  ].join("\n");
}

/**
 * Why the readings that couldn't be used went wrong (slice 0006): each
 * rejection's reason with its count, then each failed pair with its reason.
 */
export function formatUnusable(file: ReadsFile): string {
  const reasons = new Map<string, number>();
  for (const item of file.items)
    if (item.rejected !== undefined)
      reasons.set(item.rejected, (reasons.get(item.rejected) ?? 0) + 1);
  const failures = Object.entries(file.failures);
  return [
    ...(reasons.size === 0 ? [] : ["Rejected, by reason:"]),
    ...[...reasons].map(([reason, n]) => `  ${String(n).padStart(4)}  ${reason}`),
    ...(failures.length === 0 ? [] : ["Failed:"]),
    ...failures.map(([pair, reason]) => `  ${pair.padEnd(34)} ${reason}`),
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const set = args[args.indexOf("--set") + 1] as PatientSet;
  if (!args.includes("--set") || !["dev", "heldout"].includes(set)) {
    console.error("Give --set dev or heldout.");
    process.exitCode = 1;
    return;
  }
  const vocabulary = loadFactVocabulary();
  const patients = loadPatients(set, vocabulary, loadZipPoints());

  let spec: ModelSpec;
  let plan: ReturnType<typeof planPaidRun>;
  let flags: ReturnType<typeof readModelFlags>;
  try {
    flags = readModelFlags(args, ["model"]);
    spec = flags.roles["model"] as ModelSpec;
    plan = planPaidRun({
      flags,
      paid: [{ role: "reader", spec, workload: workloadFor(patients, vocabulary) }],
      scope: `${patients.length} patients' replies (${set})`,
    });
  } catch (error) {
    console.error(error instanceof ModelError ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  console.log(`${roleLine("reader", spec)}\n`);
  if (plan.kind === "estimate-only" || plan.kind === "refused") {
    console.log(plan.text);
    if (plan.kind === "refused") process.exitCode = 1;
    return;
  }

  const adapter: ModelAdapter =
    plan.kind === "spend" ? createAdapter(spec, { budget: plan.budget }) : createLocalAdapter(spec);
  mkdirSync(READS_DIR, { recursive: true });
  const path = readsPath(set, adapter.descriptor);
  const started = Date.now();
  const { file } = await readAll({
    set,
    patients,
    vocabulary,
    adapter,
    path,
    patientsSha256: patientsSha256(set),
    log: (line) => console.log(line),
    ...(spec.provider === "omlx"
      ? {}
      : {
          holdsSecret: (text: string) => keyAppearsIn(spec.provider as Provider, text, process.env),
        }),
  });
  console.log(`\nWrote ${path} in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  console.log(`${Object.keys(file.failures).length} pairs failed; a rerun retries them.\n`);
  console.log(formatGrade(gradeReads(file.items), Object.keys(file.failures).length));
  const unusable = formatUnusable(file);
  if (unusable.length > 0) console.log(`\n${unusable}`);
  if (plan.kind === "spend") {
    const usd = logSpend("questions:read", [{ role: "reader", spec, adapter }], { batch: false });
    console.log(`Spent about $${usd.toFixed(2)}.`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
