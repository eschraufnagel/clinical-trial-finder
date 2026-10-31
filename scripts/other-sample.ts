/**
 * Draws the trials slice 0005's check is measured on, and writes the label
 * skeleton (spec 0005 §3.2): every label `null`, every reason empty.
 *
 *   npm run other:sample
 *
 * - **`places-dev`:** every trial on a dev patient's short list in the
 *   committed `read-first` results.
 * - **`places-heldout`:** every trial on a held-out patient's short list
 *   there, and on no dev patient's.
 * - **`sample`:** NSCLC candidates (treatment trials the search keeps for
 *   NSCLC), ordered by `sha256("0005:" + nctId)`, the first 150.
 *
 * A trial already in 0001's labels keeps that label and is in none of these.
 *
 * ## Why this tool can't see the check
 *
 * It reads the search's vocabulary, to know which trials are candidates, but
 * nothing of `src/search/other.ts` and no model. Labels written knowing what
 * the check marks would agree with it by construction. `tests/boundary.test.ts`
 * asserts this. It refuses to overwrite a label file.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NSCLC_LABELS,
  OTHER_LABELS,
  readSearchLabels,
  type SearchLabel,
  type SearchLabels,
} from "../evals/search/labels.js";
import { loadVocabulary, reasonsFor, type Vocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";
import { isTreatment } from "./search-sample.js";

export const SAMPLE_SIZE = 150;

/** The committed results under 0004's chosen order, `read-first`, whose short lists are labelled. */
export const PLACES_RESULTS = [
  "../evals/results/questions/05-7543ffb2cb2e.json",
  "../evals/results/questions/with-reads/03-7543ffb2cb2e.json",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

/** What this tool reads of a questions result: each row's patient set and short list. */
export interface ShortlistRow {
  set: string;
  shortlist: string[];
}

export interface DrawnSets {
  placesDev: string[];
  placesHeldout: string[];
  sample: string[];
}

function rank(salt: string, nctId: string): string {
  return createHash("sha256").update(`${salt}${nctId}`).digest("hex");
}

/**
 * The three sets, each sorted by NCT ID, none sharing a trial, and none
 * holding a trial in `labelled`.
 */
export function drawSets(
  trials: readonly SnapshotTrial[],
  vocabulary: Vocabulary,
  rows: readonly ShortlistRow[],
  labelled: ReadonlySet<string>,
  size = SAMPLE_SIZE,
): DrawnSets {
  const onDev = new Set(rows.filter((r) => r.set === "dev").flatMap((r) => r.shortlist));
  const onAny = new Set(rows.flatMap((r) => r.shortlist));
  const placesDev = [...onDev].filter((id) => !labelled.has(id)).sort();
  const placesHeldout = [...onAny].filter((id) => !onDev.has(id) && !labelled.has(id)).sort();

  const taken = new Set([...labelled, ...onAny]);
  const sample = trials
    .filter((t) => isTreatment(t) && !taken.has(t.nctId) && reasonsFor(t, vocabulary).length > 0)
    .map((t) => t.nctId)
    .sort((a, b) => (rank("0005:", a) < rank("0005:", b) ? -1 : 1))
    .slice(0, size)
    .sort();
  return { placesDev, placesHeldout, sample };
}

function readRows(path: string): ShortlistRow[] {
  const result = JSON.parse(readFileSync(path, "utf8")) as { rows?: ShortlistRow[] };
  if (!Array.isArray(result.rows)) throw new Error(`${path} has no rows.`);
  return result.rows;
}

function main(): void {
  if (existsSync(OTHER_LABELS)) {
    console.error(
      `${OTHER_LABELS} already exists. The sets are fixed once drawn; delete it only on purpose.`,
    );
    process.exitCode = 1;
    return;
  }
  const nsclc = readSearchLabels(NSCLC_LABELS);
  const { manifest, trials } = loadSnapshot();
  if (nsclc.snapshot !== manifest.month) {
    throw new Error(
      `0001's labels are for ${nsclc.snapshot}, but the snapshot is ${manifest.month}.`,
    );
  }
  const known = new Set(trials.map((t) => t.nctId));
  const rows = PLACES_RESULTS.flatMap(readRows);
  const missing = [...new Set(rows.flatMap((r) => r.shortlist))].filter((id) => !known.has(id));
  if (missing.length > 0) throw new Error(`Not in the snapshot: ${missing.join(", ")}`);

  const sets = drawSets(
    trials,
    loadVocabulary(nsclc.cancerType),
    rows,
    new Set(nsclc.labels.map((l) => l.nctId)),
  );
  const skeleton = (ids: string[], set: SearchLabel["set"]): SearchLabel[] =>
    ids.map((nctId) => ({ nctId, set, relevant: null, reason: "" }));
  const file: SearchLabels = {
    version: 1,
    snapshot: manifest.month,
    cancerType: nsclc.cancerType,
    labels: [
      ...skeleton(sets.placesDev, "places-dev"),
      ...skeleton(sets.placesHeldout, "places-heldout"),
      ...skeleton(sets.sample, "sample"),
    ],
  };
  mkdirSync(dirname(OTHER_LABELS), { recursive: true });
  writeFileSync(OTHER_LABELS, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${sets.placesDev.length} places-dev, ${sets.placesHeldout.length} places-heldout and ${sets.sample.length} sample trials to ${OTHER_LABELS}`,
  );
}

if (import.meta.main) {
  main();
}
