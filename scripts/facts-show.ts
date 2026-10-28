/**
 * Prints a trial's mapped facts (spec 0002 §1).
 *
 *   npm run facts:show -- NCT05053555 [--run <dir>]
 *
 * The run defaults to the one named in data/facts/<month>/latest. Each
 * mapping is a hint the trial may not fit someone with those answers, never a
 * reason to drop the trial (`work/0002-fact-vocabulary/gate-2-finding.md`).
 */
import { readTrialFacts, runDirFor } from "../src/facts/run.js";
import type { FactVocabulary, TrialFacts } from "../src/facts/types.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

/** "ecog: rules out ps2, ps3_4" in the answers' own words. */
export function describeMapping(
  m: TrialFacts["mappings"][number],
  vocabulary: FactVocabulary,
): string {
  const fact = vocabulary.facts.find((f) => f.id === m.factId);
  const words = m.rulesOut.map((a) => fact?.answers.find((x) => x.id === a)?.words ?? a);
  const scope = m.appliesTo === undefined ? "" : ` [${m.appliesTo} only]`;
  return `${fact?.question ?? m.factId} May not fit: ${words.join("; ")}${scope}`;
}

export function formatTrialFacts(t: TrialFacts, vocabulary: FactVocabulary, title: string): string {
  const lines = [
    `${t.nctId}  ${title}`,
    `Mapped by ${t.run.model}, prompt ${t.run.promptVersion}: ${t.mappings.length} mappings, ${t.rejected.length} rejected`,
    "",
    ...t.mappings.flatMap((m) => [
      `- ${describeMapping(m, vocabulary)}`,
      `    "${m.source.text.replace(/\s+/g, " ").trim()}"`,
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const nctId = args.find((a) => /^NCT\d{8}$/.test(a));
  if (nctId === undefined) {
    console.error("Give an NCT ID.");
    process.exitCode = 1;
    return;
  }
  const { manifest, trials } = loadSnapshot();
  const dir = runDirFor(
    manifest.month,
    args.includes("--run") ? args[args.indexOf("--run") + 1] : undefined,
  );
  const facts = readTrialFacts(dir, nctId);
  if (facts === undefined) {
    console.error(`${nctId} isn't mapped in ${dir}.`);
    process.exitCode = 1;
    return;
  }
  const title = trials.find((t) => t.nctId === nctId)?.briefTitle ?? "";
  process.stdout.write(formatTrialFacts(facts, loadFactVocabulary(), title));
}

if (import.meta.main) {
  main();
}
