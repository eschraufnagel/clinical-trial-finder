/**
 * Draws the trials the search is measured on, and writes the label skeleton
 * (spec 0001 §6.2): every label `null`, every reason empty.
 *
 *   npm run search:sample
 *
 * - **Held-out:** treatment trials (or trials with no stated purpose), ordered
 *   by `sha256("0001:" + nctId)`, the first 300. Reproducible, and
 *   independent of the search and its vocabulary.
 * - **Dev:** treatment trials outside the held-out set that mention NSCLC or
 *   lung cancer in their title or eligibility text, but name neither the lung
 *   nor NSCLC in their conditions, keywords or MeSH terms. The trials most
 *   likely to be missed, by a fixed rule. At most 80, chosen by
 *   `sha256("dev:" + nctId)`.
 *
 * ## Why this tool can't see the search
 *
 * It imports nothing from `src/search/` but the text normalizer, and nothing
 * from `src/models/`. A sample or a skeleton shaped by what the search keeps
 * would make the labels agree with it by construction. `tests/boundary.test.ts`
 * asserts this. It refuses to overwrite a label file.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NSCLC_LABELS, type SearchLabels } from "../evals/search/labels.js";
import { containsTerm, normalizeText } from "../src/search/normalize.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";

export const HELDOUT_SIZE = 300;
export const DEV_CAP = 80;

const MENTIONS = [
  "non small cell",
  "nsclc",
  "lung cancer",
  "lung carcinoma",
  "lung adenocarcinoma",
  "thoracic",
];
const NAMES = ["lung", "nsclc", "thoracic"];

function rank(salt: string, nctId: string): string {
  return createHash("sha256").update(`${salt}${nctId}`).digest("hex");
}

function byRank(salt: string, trials: readonly SnapshotTrial[]): SnapshotTrial[] {
  return [...trials].sort((a, b) => (rank(salt, a.nctId) < rank(salt, b.nctId) ? -1 : 1));
}

export function isTreatment(trial: SnapshotTrial): boolean {
  return trial.primaryPurpose === null || trial.primaryPurpose === "TREATMENT";
}

export function heldOutSample(trials: readonly SnapshotTrial[], size = HELDOUT_SIZE): string[] {
  return byRank("0001:", trials.filter(isTreatment))
    .slice(0, size)
    .map((t) => t.nctId);
}

/** Mentions NSCLC or lung cancer in its title or rules, but doesn't name the lung in its conditions. */
export function mentionsButDoesNotName(trial: SnapshotTrial): boolean {
  const text = normalizeText(
    `${trial.briefTitle} ${trial.officialTitle ?? ""} ${trial.eligibility.criteriaText}`,
  );
  const named = normalizeText(
    [...trial.conditions, ...trial.keywords, ...trial.conditionMesh].join(" | "),
  );
  return MENTIONS.some((m) => containsTerm(text, m)) && !NAMES.some((n) => containsTerm(named, n));
}

export function devPool(
  trials: readonly SnapshotTrial[],
  heldOut: ReadonlySet<string>,
  cap = DEV_CAP,
): string[] {
  const pool = trials.filter(
    (t) => isTreatment(t) && !heldOut.has(t.nctId) && mentionsButDoesNotName(t),
  );
  return byRank("dev:", pool)
    .slice(0, cap)
    .map((t) => t.nctId);
}

function main(): void {
  if (existsSync(NSCLC_LABELS)) {
    console.error(
      `${NSCLC_LABELS} already exists. The sets are fixed once drawn; delete it only on purpose.`,
    );
    process.exitCode = 1;
    return;
  }
  const { manifest, trials } = loadSnapshot();
  const heldOut = heldOutSample(trials);
  const dev = devPool(trials, new Set(heldOut));
  const file: SearchLabels = {
    version: 1,
    snapshot: manifest.month,
    cancerType: "nsclc",
    labels: [
      ...[...heldOut]
        .sort()
        .map((nctId) => ({ nctId, set: "heldout" as const, relevant: null, reason: "" })),
      ...[...dev]
        .sort()
        .map((nctId) => ({ nctId, set: "dev" as const, relevant: null, reason: "" })),
    ],
  };
  mkdirSync(dirname(NSCLC_LABELS), { recursive: true });
  writeFileSync(NSCLC_LABELS, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`Wrote ${heldOut.length} held-out and ${dev.length} dev trials to ${NSCLC_LABELS}`);
}

if (import.meta.main) {
  main();
}
