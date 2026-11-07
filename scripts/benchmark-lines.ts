/**
 * Prints a check result's "may not fit" lines, for reading every one (spec
 * 0009 §2, §5.3), and renders a pair's record as text.
 *
 *   npm run benchmark:lines -- <result.json>                       every counted line, every pair
 *   npm run benchmark:lines -- <result.json> --pair nci-13:NCT02465060   one pair, every arm
 *   npm run benchmark:lines -- <result.json> --pair <p:NCT> --record     its record, re-assembled
 *
 * For each line: the parse's text, polarity and type as the agent saw them,
 * the part of the trial it's for, where the measure says it sits, and each
 * piece of evidence with the agent's restated statement and its reading.
 * Lines resting on a reply the fidelity checks flagged are listed and marked.
 *
 * `--record` assembles the record with today's `recordFor` from the
 * transcript's criteria and findings, and the parse's passages and parts, as
 * `startCheck` builds them. So a change to the record shows on old findings
 * without a model. Reaches no model, the parser or the agent's session
 * (`tests/boundary.test.ts`).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BenchmarkRow } from "../evals/benchmark/check-metrics.js";
import type { BenchmarkCheckResult } from "../evals/benchmark/check-result.js";
import type { BenchmarkTranscript } from "../evals/benchmark/check-run.js";
import type { CachedParse } from "../src/check/parse-cache.js";
import { type RecordLine, recordFor, type TrialRecord } from "../src/check/record.js";
import { fromParse } from "../src/screening/from-parse.js";
import type { Words } from "../src/shortlist/words.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CRITERIA_DIR = join(ROOT, "data", "criteria");

const text = (w: Words | null): string =>
  w === null ? "" : "ours" in w ? w.ours : "registry" in w ? w.registry : w.said;

const SECTIONS = ["earlier", "told", "records", "aboutTrial"] as const;

function recordLines(record: TrialRecord): RecordLine[] {
  return SECTIONS.flatMap((s) => record[s].lines);
}

/** Every "may not fit" line on a pair's record, counted or set aside, with what produced it. */
export function formatLines(t: BenchmarkTranscript, row: BenchmarkRow | undefined): string {
  const criteria = new Map(t.criteria.map((c) => [c.id, c]));
  const findings = new Map(t.findings.map((f) => [f.criterionId, f]));
  const kinds = new Map((row?.mayNotFit ?? []).map((l) => [l.criterionId, l.kind]));
  const excluded = new Set(row?.excluded ?? []);
  const out = [
    `### ${t.patient} ${t.nctId} ${t.arm} — ${t.label}${row === undefined ? "" : `, flagged ${row.flagged}`}`,
  ];
  for (const line of recordLines(t.record).filter((l) => l.mayNotFit)) {
    const id = line.criterionId;
    const c = criteria.get(id);
    const f = findings.get(id);
    const setAside = excluded.has(id) ? " [EXCLUDED: rests on a flagged reply]" : "";
    out.push(`- ${id} ${kinds.get(id) ?? "-"}${setAside}`);
    out.push(`    rule: ${text(line.rule)}`);
    if (c !== undefined) out.push(`    parse (${c.polarity}, ${c.type}): ${c.text}`);
    if (line.part !== null) out.push(`    part: ${text(line.part)}`);
    if (f !== undefined) {
      out.push(
        `    finding: ${f.status}, ${f.reason}${f.reported === undefined ? "" : `, reported ${f.reported}`}`,
      );
      for (const e of f.evidence) {
        out.push(
          `    turn ${e.turn}: ${e.reading}${e.withheld === undefined ? "" : ` (withheld ${e.withheld})`} on "${e.quote}"`,
        );
        if (e.statement !== undefined) out.push(`      statement: ${e.statement}`);
      }
    }
    for (const a of line.earlier) out.push(`    earlier: ${text(a.asked)} — ${text(a.said)}`);
  }
  return out.join("\n");
}

/** The parse a transcript was checked from: its file in the result's parse run. */
export function readParse(parseRunDir: string, nctId: string): CachedParse | undefined {
  if (!existsSync(parseRunDir)) return undefined;
  const name = readdirSync(parseRunDir).find(
    (f) => f.startsWith(`${nctId}-`) && f.endsWith(".json"),
  );
  return name === undefined
    ? undefined
    : (JSON.parse(readFileSync(join(parseRunDir, name), "utf8")) as CachedParse);
}

/** A pair's record assembled again with today's `recordFor`, as `startCheck` feeds it. */
export function rebuildRecord(t: BenchmarkTranscript, parsed: CachedParse): TrialRecord {
  const { ids } = fromParse(parsed);
  const wording = new Map([...ids].map(([c, id]) => [id, c.source.text]));
  const parts = new Map(
    [...ids].flatMap(([c, id]) => (c.appliesTo === undefined ? [] : [[id, c.appliesTo] as const])),
  );
  const lists = new Map(
    [...ids].flatMap(([c, id]) => (c.anyOf === undefined ? [] : [[id, c.anyOf] as const])),
  );
  return recordFor({
    study: { nctId: t.nctId, briefTitle: text(t.record.title) },
    criteria: t.criteria,
    findings: t.findings,
    wording,
    parts,
    lists,
  });
}

/** A record as plain text, section by section, as the page lays it out. */
export function formatRecord(record: TrialRecord): string {
  const out = [
    `${record.nctId}: ${text(record.title)}`,
    text(record.notADecision),
    text(record.counts.line),
  ];
  if (record.lead !== null) out.push(text(record.lead));
  for (const s of SECTIONS) {
    const section = record[s];
    out.push("", `## ${text(section.heading)}${section.folded ? " (folded)" : ""}`);
    for (const l of section.lines) {
      out.push(`- [${l.criterionId}] ${text(l.kind)}: ${text(l.rule)}`);
      if (l.part !== null) out.push(`    part: ${text(l.part)}`);
      if (l.list !== null && l.list !== undefined) out.push(`    ${text(l.list)} (${l.listId})`);
      for (const a of l.earlier) out.push(`    asked before: ${text(a.asked)} — "${text(a.said)}"`);
      for (const w of l.said) out.push(`    said: "${text(w)}"`);
      if (l.flag !== null) out.push(`    ${text(l.flag)}`);
      if (l.why !== null) out.push(`    why: ${text(l.why)}`);
    }
  }
  out.push("", `## ${text(record.toAsk.heading)}`);
  for (const item of record.toAsk.items)
    out.push(`- ${text(item.rule)}`, `    ${text(item.question)}`);
  return out.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const path = args.find((a) => a.endsWith(".json"));
  if (path === undefined) {
    console.error(
      "Usage: npm run benchmark:lines -- <result.json> [--pair <patient>:<NCT ID>] [--record]",
    );
    process.exitCode = 1;
    return;
  }
  const result = JSON.parse(readFileSync(path, "utf8")) as BenchmarkCheckResult;
  const pairArg = args.includes("--pair") ? args[args.indexOf("--pair") + 1] : undefined;
  const [patient, nctId] = pairArg?.split(":") ?? [];
  const dir = join(ROOT, result.transcripts);
  const transcripts = readdirSync(dir)
    .filter((n) => /^nci-\d+-NCT\d+-(full|account)\.json$/.test(n))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as BenchmarkTranscript)
    .filter((t) => result.arms.includes(t.arm))
    .filter((t) => pairArg === undefined || (t.patient === patient && t.nctId === nctId));
  if (transcripts.length === 0) {
    console.error(
      `No transcript${pairArg === undefined ? "" : ` for ${pairArg}`} in ${result.transcripts}.`,
    );
    process.exitCode = 1;
    return;
  }
  const rowOf = (t: BenchmarkTranscript) =>
    result.rows.find((r) => r.patient === t.patient && r.nctId === t.nctId && r.arm === t.arm);

  if (args.includes("--record")) {
    for (const t of transcripts) {
      const parsed = readParse(join(CRITERIA_DIR, result.parseRun), t.nctId);
      console.log(`=== ${t.patient} ${t.nctId} ${t.arm}\n`);
      console.log(
        parsed === undefined ? formatRecord(t.record) : formatRecord(rebuildRecord(t, parsed)),
      );
      console.log("");
    }
    return;
  }
  console.log(transcripts.map((t) => formatLines(t, rowOf(t))).join("\n\n"));
}

if (import.meta.main) {
  main();
}
