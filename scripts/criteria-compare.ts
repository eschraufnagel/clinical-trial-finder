/**
 * Compares two sets of parses of the same trials, criterion by criterion
 * (spec 0010 §5, item 2), and estimates how often lists occur (§5, item 4).
 *
 *   npm run criteria:compare -- <old dir|file> <new dir|file>
 *   npm run criteria:compare -- <old> <new> --old-prompt e1e694b399d4 --new-prompt <version>
 *                                  when both sets share one folder (the runner's parses/)
 *   npm run criteria:compare -- --lists <dir>       an estimate of list-like runs, no marks needed
 *
 * Criteria are matched by `id`, which comes from the source span, so a rule
 * split, joined or lost shows as an id on one side only. Matched criteria whose
 * polarity, type, part or statement changed are listed, then every `anyOf`
 * list and every dropped mark on the new side. Reads parse JSON only: no
 * model, not the parser, not the parse cache (`tests/boundary.test.ts`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Criterion, ParsedCriteria } from "../src/criteria/types.js";

/** A criterion as a parse file holds it, with the list mark slice 0010 adds. */
type Item = Criterion & { anyOf?: string };
/** A parse file, with the dropped marks slice 0010 adds. */
export type ParseFile = Omit<ParsedCriteria, "criteria"> & {
  criteria: Item[];
  droppedMarks?: { label: string; ids: string[]; reason: string }[];
};

/** Every parse file at a path: the file itself, or each parse in a folder. */
export function readParses(path: string, promptVersion?: string): ParseFile[] {
  const files = statSync(path).isDirectory()
    ? readdirSync(path)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(path, f))
    : [path];
  return files
    .map((f) => JSON.parse(readFileSync(f, "utf8")) as unknown)
    .filter(
      (p): p is ParseFile =>
        typeof p === "object" &&
        p !== null &&
        "nctId" in p &&
        Array.isArray((p as { criteria?: unknown }).criteria),
    )
    .filter((p) => promptVersion === undefined || p.run?.promptVersion === promptVersion);
}

export interface TrialComparison {
  nctId: string;
  matched: number;
  onlyOld: { id: string; quote: string }[];
  onlyNew: { id: string; quote: string }[];
  changed: { id: string; field: string; old: string; new: string }[];
  lists: { label: string; quotes: string[] }[];
  dropped: { label: string; reason: string }[];
}

const FIELDS = ["polarity", "type", "appliesTo", "text"] as const;

export function compareTrial(oldParse: ParseFile, newParse: ParseFile): TrialComparison {
  const oldById = new Map(oldParse.criteria.map((c) => [c.id, c]));
  const newById = new Map(newParse.criteria.map((c) => [c.id, c]));
  const changed: TrialComparison["changed"] = [];
  let matched = 0;
  for (const [id, o] of oldById) {
    const n = newById.get(id);
    if (n === undefined) continue;
    matched += 1;
    for (const field of FIELDS) {
      const a = String(o[field] ?? "");
      const b = String(n[field] ?? "");
      if (a !== b) changed.push({ id, field, old: a, new: b });
    }
  }
  const lists = new Map<string, string[]>();
  for (const c of newParse.criteria) {
    if (c.anyOf === undefined) continue;
    lists.set(c.anyOf, [...(lists.get(c.anyOf) ?? []), c.source.text]);
  }
  return {
    nctId: newParse.nctId,
    matched,
    onlyOld: oldParse.criteria
      .filter((c) => !newById.has(c.id))
      .map((c) => ({ id: c.id, quote: c.source.text })),
    onlyNew: newParse.criteria
      .filter((c) => !oldById.has(c.id))
      .map((c) => ({ id: c.id, quote: c.source.text })),
    changed,
    lists: [...lists].map(([label, quotes]) => ({ label, quotes })),
    dropped: (newParse.droppedMarks ?? []).map((d) => ({ label: d.label, reason: d.reason })),
  };
}

/** Each trial in both sets, compared; trials on one side only are named. */
export function compareSets(
  oldSet: readonly ParseFile[],
  newSet: readonly ParseFile[],
): { trials: TrialComparison[]; onlyOld: string[]; onlyNew: string[] } {
  const oldByTrial = new Map(oldSet.map((p) => [p.nctId, p]));
  const newByTrial = new Map(newSet.map((p) => [p.nctId, p]));
  const trials = [...newByTrial]
    .filter(([id]) => oldByTrial.has(id))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, n]) => compareTrial(oldByTrial.get(id) as ParseFile, n));
  return {
    trials,
    onlyOld: [...oldByTrial.keys()].filter((id) => !newByTrial.has(id)).sort(),
    onlyNew: [...newByTrial.keys()].filter((id) => !oldByTrial.has(id)).sort(),
  };
}

const clip = (s: string, n = 110): string => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

export function formatComparison(result: ReturnType<typeof compareSets>): string {
  const out: string[] = [];
  for (const t of result.trials) {
    out.push(
      `### ${t.nctId}: ${t.matched} matched, ${t.onlyOld.length} old only, ${t.onlyNew.length} new only, ${t.changed.length} changed, ${t.lists.length} lists, ${t.dropped.length} dropped marks`,
    );
    for (const c of t.onlyOld) out.push(`- old only ${c.id}: ${clip(c.quote)}`);
    for (const c of t.onlyNew) out.push(`- new only ${c.id}: ${clip(c.quote)}`);
    for (const c of t.changed) {
      out.push(`- changed ${c.id} ${c.field}: ${clip(c.old, 60)} → ${clip(c.new, 60)}`);
    }
    for (const l of t.lists) {
      out.push(`- list "${l.label}":`);
      for (const q of l.quotes) out.push(`    · ${clip(q)}`);
    }
    for (const d of t.dropped) out.push(`- dropped mark "${d.label}": ${d.reason}`);
  }
  const sum = (f: (t: TrialComparison) => number) => result.trials.reduce((n, t) => n + f(t), 0);
  out.push(
    "",
    `Totals over ${result.trials.length} trials: ${sum((t) => t.matched)} matched, ` +
      `${sum((t) => t.onlyOld.length)} old only, ${sum((t) => t.onlyNew.length)} new only, ` +
      `${sum((t) => t.changed.filter((c) => c.field === "polarity").length)} polarity changed, ` +
      `${sum((t) => t.changed.filter((c) => c.field === "type").length)} type changed, ` +
      `${sum((t) => t.changed.filter((c) => c.field === "appliesTo").length)} part changed, ` +
      `${sum((t) => t.changed.filter((c) => c.field === "text").length)} statement changed; ` +
      `${sum((t) => t.lists.length)} lists, ${sum((t) => t.dropped.length)} dropped marks.`,
  );
  if (result.onlyOld.length > 0) out.push(`Old side only: ${result.onlyOld.join(", ")}`);
  if (result.onlyNew.length > 0) out.push(`New side only: ${result.onlyNew.join(", ")}`);
  return out.join("\n");
}

export interface ListEstimate {
  trials: number;
  /** Trials with at least one list-like run. */
  trialsWithLists: number;
  /** Runs ending ", or" / " or": the item and the one after it. */
  orRuns: number;
  /** Runs of two or more items following a criterion whose source ends in ":". */
  leadInRuns: number;
}

/**
 * List-like runs, read from the source text alone, with no model and no
 * marks: an estimate of how often lists reach the check, not a count of them.
 */
export function estimateLists(parses: readonly ParseFile[]): ListEstimate {
  let orRuns = 0;
  let leadInRuns = 0;
  let trialsWithLists = 0;
  for (const p of parses) {
    const quotes = p.criteria.map((c) => c.source.text.trim());
    let found = 0;
    for (let i = 0; i + 1 < quotes.length; i++) {
      if (/(,\s*|\s)or$/i.test(quotes[i] as string)) found += 1;
    }
    orRuns += found;
    let leads = 0;
    for (let i = 0; i + 2 < quotes.length; i++) {
      if ((quotes[i] as string).endsWith(":")) leads += 1;
    }
    leadInRuns += leads;
    if (found + leads > 0) trialsWithLists += 1;
  }
  return { trials: parses.length, trialsWithLists, orRuns, leadInRuns };
}

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const listsDir = valueAfter(args, "--lists");
  if (listsDir !== undefined) {
    const e = estimateLists(readParses(listsDir));
    console.log(
      `An estimate from source text, not a count of marked lists.\n` +
        `${e.trials} trials; ${e.trialsWithLists} with a list-like run; ` +
        `${e.orRuns} items ending in "or"; ${e.leadInRuns} lead-ins ending in ":" followed by two or more criteria.`,
    );
    return;
  }
  const flagged = new Set(
    ["--old-prompt", "--new-prompt"].flatMap((f) => [f, valueAfter(args, f)]),
  );
  const [oldPath, newPath] = args.filter((a) => !flagged.has(a));
  if (oldPath === undefined || newPath === undefined) {
    console.error("Give an old and a new parse folder or file, or --lists <dir>.");
    process.exitCode = 1;
    return;
  }
  const result = compareSets(
    readParses(oldPath, valueAfter(args, "--old-prompt")),
    readParses(newPath, valueAfter(args, "--new-prompt")),
  );
  console.log(formatComparison(result));
}

if (import.meta.main) main();
