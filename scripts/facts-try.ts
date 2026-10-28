/**
 * Runs the search, then a made-up profile's answers against the trials it
 * keeps (spec 0002 §1, amended after Gate 2).
 *
 *   npm run facts:try -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female \
 *     --profile evals/cases/facts/profiles/example.json [--run <dir>]
 *
 * No trial is dropped by the answers. It prints how many trials have hints
 * ("may not fit", with the trial's words), the trials with the most, and which
 * unanswered questions would flag the most trials. No model, no network.
 */
import { readFileSync } from "node:fs";
import { readTrialFacts, runDirFor } from "../src/facts/run.js";
import { dependsOn, type Profile, statusFor, type TrialStatus } from "../src/facts/status.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadZipPoints } from "../src/search/geo.js";
import { searchTrials } from "../src/search/search.js";
import { loadVocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import { describeMapping } from "./facts-show.js";
import { formatResult, parseArgs } from "./search.js";

export interface TryResult {
  searched: number;
  unmapped: string[];
  statuses: TrialStatus[];
}

export function formatTry(
  result: TryResult,
  vocabulary: FactVocabulary,
  titles: ReadonlyMap<string, string>,
): string {
  const withHints = result.statuses.filter((s) => s.hints.length > 0);
  const partOnly = result.statuses.filter((s) => s.hints.length === 0 && s.partHints.length > 0);
  const lines = [
    `Of ${result.searched} trials, ${result.statuses.length} are mapped${result.unmapped.length === 0 ? "" : ` (${result.unmapped.length} not mapped)`}.`,
    `${withHints.length} have a hint the trial may not fit these answers, ${partOnly.length} only for part of the trial, ${result.statuses.length - withHints.length - partOnly.length} none. None is dropped: the oncologist decides.`,
    "",
    "Most hints for the whole trial:",
  ];
  // Whole-trial hints rank; hints about one cohort or part follow them.
  const ranked = [...withHints].sort(
    (a, b) => b.hints.length - a.hints.length || (a.nctId < b.nctId ? -1 : 1),
  );
  for (const s of ranked.slice(0, 5)) {
    lines.push(`  ${s.nctId}  ${titles.get(s.nctId) ?? ""}`);
    for (const m of [...s.hints, ...s.partHints]) {
      lines.push(`    - ${describeMapping(m, vocabulary)}`);
      lines.push(`      "${m.source.text.replace(/\s+/g, " ").trim().slice(0, 160)}"`);
    }
  }
  lines.push("", "Questions an answer to which would flag the most trials:");
  for (const { factId, trials } of dependsOn(result.statuses).slice(0, 8)) {
    const question = vocabulary.facts.find((f) => f.id === factId)?.question ?? factId;
    lines.push(`  ${String(trials).padStart(4)}  ${question}`);
  }
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const profilePath = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : undefined;
  if (profilePath === undefined) {
    console.error("Give --profile <file>, as well as the search flags.");
    process.exitCode = 1;
    return;
  }
  let request: ReturnType<typeof parseArgs>["request"];
  try {
    ({ request } = parseArgs(args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const { manifest, trials } = loadSnapshot();
  const cancer = loadVocabulary(request.cancerType);
  const search = searchTrials(trials, manifest, cancer, loadZipPoints(), request);
  // The search's funnel, without its rows: everything before the first blank line.
  process.stdout.write(`${formatResult(search, cancer.type.label).split("\n\n")[0]}\n\n`);

  const vocabulary = loadFactVocabulary();
  const profile = JSON.parse(readFileSync(profilePath, "utf8")) as Profile;
  const dir = runDirFor(
    manifest.month,
    args.includes("--run") ? args[args.indexOf("--run") + 1] : undefined,
  );
  const statuses: TrialStatus[] = [];
  const unmapped: string[] = [];
  for (const c of search.candidates) {
    const facts = readTrialFacts(dir, c.nctId);
    if (facts === undefined) unmapped.push(c.nctId);
    else statuses.push(statusFor(facts, profile, vocabulary));
  }
  const titles = new Map(search.candidates.map((c) => [c.nctId, c.briefTitle]));
  process.stdout.write(
    formatTry({ searched: search.candidates.length, unmapped, statuses }, vocabulary, titles),
  );
}

if (import.meta.main) {
  main();
}
