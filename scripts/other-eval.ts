/**
 * Slice 0005's measurement of trials for other cancers (spec 0005 §4.6).
 *
 *   npm run other:eval -- --places <questions result>
 *
 * `--places`: for each row of a committed `questions:eval` result, the
 * short-list places held by trials labelled not for NSCLC, read from 0001's
 * labels and 0005's together. Deterministic: no model, no network. The
 * scoring of the check comes with the check (plan step 8).
 */
import { readFileSync } from "node:fs";
import {
  NSCLC_LABELS,
  OTHER_LABELS,
  OTHER_SETS,
  readSearchLabels,
} from "../evals/search/labels.js";
import { type PlacesRow, placesHeld, summarizePlaces } from "../evals/search/other.js";

function readRows(path: string): PlacesRow[] {
  const result = JSON.parse(readFileSync(path, "utf8")) as { rows?: PlacesRow[] };
  if (!Array.isArray(result.rows)) throw new Error(`${path} has no rows.`);
  return result.rows;
}

function main(): void {
  const args = process.argv.slice(2);
  const at = args.indexOf("--places");
  const path = at < 0 ? undefined : args[at + 1];
  if (path === undefined) {
    console.error("Usage: npm run other:eval -- --places <questions result>");
    process.exitCode = 1;
    return;
  }
  const labels = [
    ...readSearchLabels(NSCLC_LABELS).labels,
    ...readSearchLabels(OTHER_LABELS, OTHER_SETS).labels,
  ];
  const held = placesHeld(readRows(path), labels);

  console.log(`Short-list places held by trials labelled not for NSCLC, in ${path}\n`);
  console.log(
    "set      arm           scorer      patients  places  not NSCLC  patients with any  unlabelled",
  );
  for (const s of summarizePlaces(held)) {
    console.log(
      [
        s.set.padEnd(8),
        s.arm.padEnd(13),
        (s.scorer ?? "—").padEnd(11),
        String(s.patients).padStart(8),
        String(s.places).padStart(7),
        String(s.notRelevant).padStart(10),
        String(s.patientsWithAny).padStart(18),
        String(s.unlabelled).padStart(11),
      ].join(" "),
    );
  }

  const counts = new Map<string, number>();
  for (const row of held)
    for (const id of row.notRelevant) counts.set(id, (counts.get(id) ?? 0) + 1);
  console.log("\nTrials labelled not for NSCLC, by places held across every row:");
  for (const [id, n] of [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
    console.log(`  ${id}  ${n}`);
  }
}

if (import.meta.main) {
  main();
}
