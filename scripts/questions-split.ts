/**
 * Moves newly written patients into their sets (spec 0003 §5.3).
 *
 *   npm run questions:split              move evals/cases/patients/staging/ into dev/ and heldout/
 *   npm run questions:split -- --dry-run  check them and print where each would go
 *
 * Each patient goes to the set its id's hash sends it to (`setFor`), so the
 * author doesn't choose which are held out. Refuses if either set already has
 * patients: the split happens once, for all of them together. Prints the
 * knowledge rates beside the convention's targets.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import {
  knowledgeRates,
  loadPatientDir,
  PATIENTS_DIR,
  type Patient,
  setFor,
} from "../evals/questions/patients.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadZipPoints } from "../src/search/geo.js";

/** AUTHORING.md Rule 4. */
const TARGETS = { patient: 0.9, oncologist: 0.3, records: 0.35 } as const;

export function formatRates(patients: readonly Patient[], vocabulary: FactVocabulary): string {
  const lines = ["Known, of the facts the records hold:"];
  for (const r of knowledgeRates(patients, vocabulary)) {
    const share = r.held === 0 ? 0 : r.known / r.held;
    lines.push(
      `  ${r.whoKnows.padEnd(10)} ${String(r.known).padStart(4)} of ${String(r.held).padEnd(4)} ${(100 * share).toFixed(0)}%   (target about ${(100 * TARGETS[r.whoKnows]).toFixed(0)}%)`,
    );
  }
  return lines.join("\n");
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const staging = join(PATIENTS_DIR, "staging");
  const vocabulary = loadFactVocabulary();
  const patients = loadPatientDir(staging, vocabulary, loadZipPoints());

  const occupied = (["dev", "heldout"] as const).filter((set) => {
    const dir = join(PATIENTS_DIR, set);
    return existsSync(dir) && readdirSync(dir).some((n) => n.endsWith(".json"));
  });
  if (!dryRun && occupied.length > 0) {
    console.error(
      `Refusing: ${occupied.join(" and ")} already hold patients. The split is done once.`,
    );
    process.exitCode = 1;
    return;
  }

  for (const p of patients) {
    const set = setFor(p.id);
    console.log(`${p.id}  ${set}`);
    if (dryRun) continue;
    mkdirSync(join(PATIENTS_DIR, set), { recursive: true });
    renameSync(join(staging, `${p.id}.json`), join(PATIENTS_DIR, set, `${p.id}.json`));
  }
  const dev = patients.filter((p) => setFor(p.id) === "dev").length;
  console.log(
    `\n${dev} dev, ${patients.length - dev} held out.\n${formatRates(patients, vocabulary)}`,
  );
  if (!dryRun && readdirSync(staging).length === 0) rmdirSync(staging);
}

if (import.meta.main) {
  main();
}
