/**
 * Searches the snapshot for a person, from the terminal (spec 0001 §1).
 *
 *   npm run search -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female
 *
 * --miles anywhere   no distance limit (default 100)
 * --purpose all      keep every purpose, not only treatment
 * --json             print the result object
 *
 * No model, no network: it reads the committed snapshot, ZIP table and
 * vocabulary. The ZIP and age are a search, never stored.
 */
import { loadZipPoints } from "../src/search/geo.js";
import { searchTrials } from "../src/search/search.js";
import type { Candidate, SearchRequest, SearchResult } from "../src/search/types.js";
import { loadVocabulary, type Reason } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

const STAGE_WORDS: Record<string, string> = {
  purpose: "treatment trials",
  cancer: "for the cancer type",
  "age-and-sex": "open to the person's age and sex",
  distance: "recruiting within the distance",
};

const REASON_WORDS: Record<Reason, string> = {
  names: "names it",
  rules: "mentions it in its rules",
  generic: "open to many",
};

const FLAG_WORDS: Record<string, string> = {
  "stale-record": "record not updated in over a year",
  "past-completion": "completion date has passed",
  "age-limit-unread": "age limit unreadable",
  "site-distance-unknown": "nearest site has no location",
};

export function parseArgs(args: readonly string[]): { request: SearchRequest; json: boolean } {
  const value = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const problems: string[] = [];
  const cancerType = value("--cancer") ?? "";
  if (cancerType === "") problems.push("--cancer is required, for example --cancer nsclc");
  const zip = value("--zip") ?? "";
  if (zip === "") problems.push("--zip is required, for example --zip 60611");
  const age = Number(value("--age"));
  if (!Number.isInteger(age) || age < 0 || age > 120)
    problems.push("--age must be whole years, 0 to 120");
  const sex = value("--sex");
  if (sex !== "female" && sex !== "male") problems.push("--sex must be female or male");
  const miles = value("--miles") ?? "100";
  const radiusMiles = miles === "anywhere" ? null : Number(miles);
  if (radiusMiles !== null && !(radiusMiles > 0))
    problems.push('--miles must be a number of miles or "anywhere"');
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return {
    request: {
      cancerType,
      age,
      sex: sex as "female" | "male",
      zip,
      radiusMiles,
      purposes: value("--purpose") === "all" ? "all" : ["TREATMENT"],
    },
    json: args.includes("--json"),
  };
}

export function formatResult(result: SearchResult, label: string): string {
  const { snapshot, funnel, request, candidates } = result;
  const first = funnel[0]?.count ?? 0;
  const lines = [
    `Snapshot ${snapshot.month}: ${first.toLocaleString("en-US")} trials (registry data of ${snapshot.dataTimestamp.slice(0, 10)})`,
  ];
  const cancer = funnel.find((f) => f.stage === "cancer");
  const reasonCounts = (["names", "rules", "generic"] as Reason[])
    .map((r) => `${REASON_WORDS[r]} ${candidates.filter((c) => c.reasons.includes(r)).length}`)
    .join(" · ");
  for (const { stage, count } of funnel.slice(1)) {
    let words = STAGE_WORDS[stage] ?? stage;
    if (stage === "purpose" && request.purposes === "all") words = "any purpose";
    if (stage === "cancer") words = `for ${label}`;
    if (stage === "age-and-sex") words = `open to a ${request.age}-year-old ${request.sex}`;
    if (stage === "distance")
      words =
        request.radiusMiles === null
          ? "recruiting anywhere in the US"
          : `recruiting within ${request.radiusMiles} miles`;
    const suffix =
      stage === "distance" && cancer !== undefined ? `   (of these: ${reasonCounts})` : "";
    lines.push(`  ${words.padEnd(36)} ${count.toLocaleString("en-US").padStart(6)}${suffix}`);
  }
  lines.push("");
  for (const c of candidates) lines.push(formatCandidate(c));
  return `${lines.join("\n")}\n`;
}

function formatCandidate(c: Candidate): string {
  const phase =
    c.phases.length === 0
      ? "—"
      : c.phases
          .map((p) => p.replace("PHASE", "Phase ").replace("EARLY_Phase 1", "Early Phase 1"))
          .join("/");
  const reasons = c.reasons.map((r) => REASON_WORDS[r]).join(", ");
  const site = c.nearestSite;
  const where =
    site === null
      ? "no site"
      : `${site.miles === null ? "  ?" : String(site.miles).padStart(4)} mi  ${[site.facility, [site.city, site.state].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`;
  const flags = c.flags.map((f) => FLAG_WORDS[f] ?? f).join("; ");
  return `${c.nctId}  ${phase.padEnd(16)}${where}  · ${reasons}${flags === "" ? "" : `  [${flags}]`}`;
}

function main(): void {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const { manifest, trials } = loadSnapshot();
  const vocabulary = loadVocabulary(parsed.request.cancerType);
  const result = searchTrials(trials, manifest, vocabulary, loadZipPoints(), parsed.request);
  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  process.stdout.write(formatResult(result, vocabulary.type.label));
  if (!vocabulary.type.measured) {
    console.log(`\nThe ${vocabulary.type.label} vocabulary hasn't been measured yet.`);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
