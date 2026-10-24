/**
 * Prints trials for labelling (spec 0001 §6.2): title, purpose, phase,
 * conditions, keywords, MeSH terms, interventions and the eligibility text,
 * as the snapshot holds them.
 *
 *   npm run search:show -- NCT07148128
 *   npm run search:show -- --next [N]     the next N unlabelled trials in the label file (default 1)
 *   add --brief to print only the eligibility lines about disease scope
 *
 * Like `search:sample`, it can't see the search: it prints the registry's
 * words and nothing derived from them, so a label is written before its
 * trial's search result is known. `tests/boundary.test.ts` asserts this.
 */
import { NSCLC_LABELS, readSearchLabels } from "../evals/search/labels.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";

/**
 * Words that say which cancers a line is about. `--brief` prints only the
 * eligibility lines that contain one, so a labeller reads the disease scope
 * without the lab values and contraception rules around it. A fixed list,
 * the same for every trial, and nothing derived from the search.
 */
const SCOPE_WORDS =
  /cancer|carcinoma|tumou?r|malignan|neoplas|sarcoma|lymphoma|leuka?emia|myeloma|melanoma|glioma|blastoma|metasta|cohort|histolog|cytolog|solid|lung|nsclc|thoracic/i;

/** The eligibility lines a labeller needs for disease scope, each cut to 400 characters. */
export function scopeLines(criteriaText: string): string[] {
  return criteriaText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => SCOPE_WORDS.test(line))
    .map((line) => (line.length > 400 ? `${line.slice(0, 400)} …` : line));
}

export function describeForLabelling(trial: SnapshotTrial, set?: string, brief = false): string {
  const list = (items: readonly string[]) => (items.length === 0 ? "—" : items.join("; "));
  const text = trial.eligibility.criteriaText;
  return [
    `=== ${trial.nctId}${set === undefined ? "" : `  (${set})`}`,
    `Title:          ${trial.briefTitle}`,
    `Official title: ${trial.officialTitle ?? "—"}`,
    `Purpose:        ${trial.primaryPurpose ?? "—"}    Phase: ${list(trial.phases)}`,
    `Conditions:     ${list(trial.conditions)}`,
    `Keywords:       ${list(trial.keywords)}`,
    `MeSH:           ${list(trial.conditionMesh)}`,
    `Interventions:  ${list(trial.interventions.map((i) => i.name))}`,
    `Ages:           ${trial.eligibility.minimumAge ?? "no minimum"} to ${trial.eligibility.maximumAge ?? "no maximum"}`,
    brief
      ? `Eligibility, lines about disease scope only (${text.length} characters in all):`
      : "Eligibility:",
    ...(brief ? scopeLines(text).map((line) => `  | ${line}`) : [text]),
    "",
  ].join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const brief = args.includes("--brief");
  const { trials } = loadSnapshot();
  const byId = new Map(trials.map((t) => [t.nctId, t]));

  let wanted: { nctId: string; set?: string }[];
  const next = args.indexOf("--next");
  if (next >= 0) {
    const count = Number(args[next + 1] ?? "1") || 1;
    wanted = readSearchLabels(NSCLC_LABELS)
      .labels.filter((l) => l.relevant === null)
      .slice(0, count)
      .map((l) => ({ nctId: l.nctId, set: l.set }));
    if (wanted.length === 0) console.log("Every trial in the label file is labelled.");
  } else {
    wanted = args.filter((a) => /^NCT\d{8}$/i.test(a)).map((a) => ({ nctId: a.toUpperCase() }));
    if (wanted.length === 0) {
      console.error("Usage: npm run search:show -- <NCT ID>... | --next [N] [--brief]");
      process.exitCode = 1;
      return;
    }
  }

  for (const { nctId, set } of wanted) {
    const trial = byId.get(nctId);
    if (trial === undefined) {
      console.error(`${nctId} isn't in the snapshot.`);
      process.exitCode = 1;
      continue;
    }
    console.log(describeForLabelling(trial, set, brief));
  }
}

if (import.meta.main) {
  main();
}
