import { describe, expect, it } from "vitest";
import type { BenchmarkRow } from "../../evals/benchmark/check-metrics.js";
import type { BenchmarkTranscript } from "../../evals/benchmark/check-run.js";
import { formatLines, formatRecord, rebuildRecord } from "../../scripts/benchmark-lines.js";
import type { CachedParse } from "../../src/check/parse-cache.js";
import {
  HEADING_ABOUT_TRIAL,
  HEADING_EARLIER,
  HEADING_RECORDS,
  HEADING_TO_ASK,
  HEADING_TOLD,
  LIST_ANY,
  MAY_NOT_FIT_PART,
  recordFor,
} from "../../src/check/record.js";
import type { Finding, ScreeningCriterion } from "../../src/screening/types.js";

/** Made-up criteria text and a made-up pair; nothing here is from a real record. */
const TEXT =
  "Inclusion Criteria:\n* Arm B: prior surgery\nExclusion Criteria:\n* Currently pregnant";
const span = (text: string) => {
  const start = TEXT.indexOf(text);
  return { start, end: start + text.length, text };
};
const CRITERIA: ScreeningCriterion[] = [
  { id: "P1", polarity: "inclusion", type: "patient", text: "The participant had prior surgery" },
  { id: "P2", polarity: "exclusion", type: "patient", text: "The participant is pregnant" },
];
const STUDY = { nctId: "NCT00000002", briefTitle: "A made-up trial" };
const FINDINGS: Finding[] = [
  {
    criterionId: "P1",
    status: "does-not-hold",
    reason: "answered",
    evidence: [
      {
        turn: 1,
        quote: "No surgery",
        reading: "does-not-hold",
        statement: "The person had surgery.",
      },
    ],
    timesAsked: 1,
  },
  {
    criterionId: "P2",
    status: "holds",
    reason: "answered",
    evidence: [{ turn: 3, quote: "I am", reading: "holds" }],
    timesAsked: 1,
  },
];

const T: BenchmarkTranscript = {
  patient: "nci-90",
  nctId: STUDY.nctId,
  label: "recommended",
  set: "dev",
  arm: "full",
  parse: "parsed",
  criteria: CRITERIA,
  sources: { P1: span("prior surgery"), P2: span("Currently pregnant") },
  findings: FINDINGS,
  transcript: [],
  rejectedReadings: [],
  ignoredReadings: [],
  replies: [],
  record: recordFor({ study: STUDY, criteria: CRITERIA, findings: FINDINGS }),
  calls: { agent: 0, participant: 0, fidelity: 0 },
  run: null,
};

const ROW = {
  patient: T.patient,
  nctId: T.nctId,
  arm: "full",
  flagged: true,
  mayNotFit: [{ criterionId: "P1", kind: "asked" }],
  excluded: ["P2"],
} as unknown as BenchmarkRow;

const PARSED: CachedParse = {
  nctId: STUDY.nctId,
  criteria: [
    {
      id: "a",
      polarity: "inclusion",
      type: "patient",
      text: "The participant had prior surgery",
      source: span("prior surgery"),
      appliesTo: "Arm B",
      confidence: null,
    },
    {
      id: "b",
      polarity: "exclusion",
      type: "patient",
      text: "The participant is pregnant",
      source: span("Currently pregnant"),
      confidence: null,
    },
  ],
  rejected: [],
  unclaimed: [],
  run: {
    model: "fake",
    quantization: "none",
    temperature: 0,
    seed: 0,
    adapter: "fake",
    promptVersion: "x",
    timestamp: "2000-06",
  },
  criteriaSha256: "x",
};

describe("benchmark:lines", () => {
  it("lists each may-not-fit line with the parse's polarity, the statement and the reading", () => {
    const out = formatLines(T, ROW);
    expect(out).toContain("P1 asked");
    expect(out).toContain("parse (inclusion, patient): The participant had prior surgery");
    expect(out).toContain('turn 1: does-not-hold on "No surgery"');
    expect(out).toContain("statement: The person had surgery.");
  });

  it("marks a line resting on a flagged reply", () => {
    expect(formatLines(T, ROW)).toContain("P2 - [EXCLUDED: rests on a flagged reply]");
  });

  it("rebuilds the record with the parse's passages and parts", () => {
    const record = rebuildRecord(T, PARSED);
    const p1 = record.told.lines.find((l) => l.criterionId === "P1");
    expect(p1?.rule).toEqual({ registry: "prior surgery" });
    expect(p1?.part).toEqual({ registry: "Arm B" });
    expect(p1?.flag).toEqual({ ours: MAY_NOT_FIT_PART });
  });

  it("renders every section of a record", () => {
    const out = formatRecord(rebuildRecord(T, PARSED));
    for (const heading of [
      HEADING_EARLIER,
      HEADING_TOLD,
      HEADING_RECORDS,
      HEADING_ABOUT_TRIAL,
      HEADING_TO_ASK,
    ]) {
      expect(out).toContain(`## ${heading}`);
    }
  });

  it("reads a parse's list marks onto the record (0010)", () => {
    const marked: CachedParse = {
      ...PARSED,
      criteria: PARSED.criteria.map((c) => ({ ...c, anyOf: "pair" })),
    };
    const out = formatRecord(rebuildRecord(T, marked));
    expect(out).toContain(`${LIST_ANY} (pair)`);
    expect(formatRecord(rebuildRecord(T, PARSED))).not.toContain(LIST_ANY);
  });
});
