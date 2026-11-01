import { describe, expect, it } from "vitest";
import {
  compareArms,
  scoreBenchmarkPair,
  summarizeArm,
} from "../../evals/benchmark/check-metrics.js";
import { benchmarkRegradeProblems, scoreBenchmark } from "../../evals/benchmark/check-result.js";
import { type BenchmarkTranscript, checkBenchmarkPair } from "../../evals/benchmark/check-run.js";
import type { BenchmarkPair } from "../../evals/benchmark/pairs.js";
import { criteriaSha256 } from "../../src/check/parse-cache.js";
import { recordFor } from "../../src/check/record.js";
import type { ParseableTrial } from "../../src/criteria/prompt.js";
import type { ParsedCriteria } from "../../src/criteria/types.js";
import { FakeModelAdapter } from "../../src/models/index.js";
import { ASK_SYSTEM_PROMPT } from "../../src/screening/prompts.js";
import type { Finding, ScreeningCriterion } from "../../src/screening/types.js";

/** Made-up criteria text and patients; nothing here is from a real record. */
const TEXT =
  "Inclusion Criteria:\n* ECOG 0 or 1\n* Prior platinum chemotherapy\nExclusion Criteria:\n* Brain metastases";
const span = (text: string) => {
  const start = TEXT.indexOf(text);
  return { start, end: start + text.length, text };
};
const CRITERIA: ScreeningCriterion[] = [
  { id: "P1", polarity: "inclusion", type: "patient", text: "ECOG 0 or 1" },
  { id: "P2", polarity: "inclusion", type: "patient", text: "Prior platinum chemotherapy" },
  { id: "P3", polarity: "exclusion", type: "patient", text: "Brain metastases" },
];
const SOURCES = {
  P1: span("ECOG 0 or 1"),
  P2: span("Prior platinum chemotherapy"),
  P3: span("Brain metastases"),
};
const STUDY = { nctId: "NCT00000001", briefTitle: "A made-up trial" };

const finding = (id: string, status: Finding["status"], turn = 1): Finding => ({
  criterionId: id,
  status,
  reason: "answered",
  evidence: [{ turn, quote: "x", reading: status === "holds" ? "holds" : "does-not-hold" }],
  timesAsked: 1,
});

function transcript(
  pair: BenchmarkPair,
  arm: "full" | "account",
  findings: Finding[],
  flaggedTurns: number[] = [],
): BenchmarkTranscript {
  return {
    ...pair,
    arm,
    parse: "parsed",
    criteria: CRITERIA,
    sources: SOURCES,
    findings,
    transcript: [
      {
        index: 0,
        speaker: "agent",
        kind: "question",
        text: "Are you up and about?",
        criterionId: "P1",
      },
      { index: 1, speaker: "participant", kind: "reply", text: "Yes." },
    ],
    rejectedReadings: [],
    ignoredReadings: [],
    replies: [1, 3].map((turn) => ({
      turn,
      quotes: [],
      flags: flaggedTurns.includes(turn) ? [{ kind: "model" as const, reason: "invented" }] : [],
    })),
    record: recordFor({ study: STUDY, criteria: CRITERIA, findings }),
    calls: { agent: 0, participant: 0, fidelity: 0 },
    run: null,
  };
}

const ineligible: BenchmarkPair = {
  patient: "nci-90",
  nctId: "NCT00000001",
  label: "ineligible",
  set: "dev",
};
const eligible: BenchmarkPair = { ...ineligible, patient: "nci-91", label: "recommended" };

describe("scoreBenchmarkPair", () => {
  it("catches an ineligible pair on the clinician's named rule", () => {
    const t = transcript(ineligible, "full", [
      finding("P2", "does-not-hold"),
      finding("P1", "holds"),
    ]);
    const row = scoreBenchmarkPair(
      t,
      {
        patient: "nci-90",
        nctId: "NCT00000001",
        kind: "rule",
        quote: "Prior platinum chemotherapy",
      },
      TEXT,
    );
    expect(row).toMatchObject({ flagged: true, named: "rule-caught", asked: 1 });
    expect(row.mayNotFit).toEqual([{ criterionId: "P2", kind: "asked" }]);
    expect(row.verdictHits).toEqual([]);
  });

  it("tells a catch on another rule from a miss, and counts a disease or no-reason pair apart", () => {
    const other = transcript(ineligible, "full", [finding("P3", "holds")]);
    const reason = {
      patient: "nci-90",
      nctId: "NCT00000001",
      kind: "rule" as const,
      quote: "ECOG 0 or 1",
    };
    expect(scoreBenchmarkPair(other, reason, TEXT).named).toBe("rule-other");
    const none = transcript(ineligible, "full", [finding("P1", "holds")]);
    expect(scoreBenchmarkPair(none, reason, TEXT)).toMatchObject({
      flagged: false,
      named: "rule-missed",
    });
    expect(
      scoreBenchmarkPair(none, { patient: "nci-90", nctId: "NCT00000001", kind: "disease" }, TEXT)
        .named,
    ).toBe("disease");
    expect(scoreBenchmarkPair(none, undefined, TEXT).named).toBe("none");
  });

  it("counts a false alarm on an eligible pair, and not one resting on an unfaithful reply", () => {
    const alarm = transcript(eligible, "full", [finding("P3", "holds")]);
    expect(scoreBenchmarkPair(alarm, undefined, TEXT)).toMatchObject({
      flagged: true,
      named: null,
    });
    const unfaithful = transcript(eligible, "full", [finding("P3", "holds", 1)], [1]);
    expect(scoreBenchmarkPair(unfaithful, undefined, TEXT)).toMatchObject({
      flagged: false,
      excluded: ["P3"],
      flags: 1,
    });
  });

  it("finds an unknown left off the record", () => {
    const t = transcript(eligible, "full", [finding("P1", "unresolved")]);
    t.record = { ...t.record, records: { ...t.record.records, lines: [] } };
    expect(scoreBenchmarkPair(t, undefined, TEXT).unknownsMissing).toEqual(["P1"]);
  });
});

describe("the arms", () => {
  const rows = [
    scoreBenchmarkPair(transcript(ineligible, "full", [finding("P3", "holds")]), undefined, TEXT),
    scoreBenchmarkPair(
      transcript(ineligible, "account", [finding("P1", "holds")]),
      undefined,
      TEXT,
    ),
    scoreBenchmarkPair(transcript(eligible, "full", [finding("P3", "holds")]), undefined, TEXT),
    scoreBenchmarkPair(transcript(eligible, "account", [finding("P3", "holds")]), undefined, TEXT),
  ];

  it("summarize caught and false alarms, with where each false alarm's lines sit", () => {
    const full = summarizeArm(
      "full",
      rows.filter((r) => r.arm === "full"),
    );
    expect(full.caught).toMatchObject({ kept: 1, n: 1 });
    expect(full.falseAlarms).toMatchObject({ kept: 1, n: 1 });
    expect(full.falseAlarmsByLabel["recommended"]).toMatchObject({ kept: 1, n: 1 });
    expect(full.falseAlarmLines.asked).toBe(1);
    expect(full.byNamed.none).toBe(1);
  });

  it("compare pair by pair", () => {
    expect(compareArms(rows)).toEqual({
      pairs: 2,
      caught: { both: [], fullOnly: ["nci-90 NCT00000001"], accountOnly: [] },
      falseAlarms: { both: ["nci-91 NCT00000001"], fullOnly: [], accountOnly: [] },
    });
  });

  it("regrade a result from its transcripts, and notice a change", () => {
    const transcripts = [
      transcript(ineligible, "full", [finding("P3", "holds")]),
      transcript(eligible, "full", [finding("P3", "holds")]),
    ];
    const pairs = [ineligible, eligible];
    const scored = scoreBenchmark(transcripts, pairs, ["full"], [], () => TEXT);
    const sums = { pairsSha256: "a", accountsSha256: "b", reasonsSha256: "c" };
    const committed = {
      version: 1 as const,
      set: "dev" as const,
      arms: ["full" as const],
      ...sums,
      parseRun: "",
      parser: null,
      run: {
        agent: null,
        participant: {
          model: "fake",
          quantization: "none",
          temperature: 0,
          seed: 0,
          adapter: "fake",
          promptVersion: "x",
          timestamp: "2000-06",
        },
      },
      transcripts: "",
      ...scored,
    };
    expect(benchmarkRegradeProblems(committed, transcripts, pairs, [], () => TEXT, sums)).toEqual(
      [],
    );
    const changed = [
      transcript(ineligible, "full", [finding("P1", "holds")]),
      transcripts[1] as BenchmarkTranscript,
    ];
    expect(benchmarkRegradeProblems(committed, changed, pairs, [], () => TEXT, sums)).toContain(
      "rows differ",
    );
    expect(
      benchmarkRegradeProblems(committed, transcripts, pairs, [], () => TEXT, {
        ...sums,
        reasonsSha256: "z",
      }),
    ).toContain("reasonsSha256 differs");
  });
});

describe("checkBenchmarkPair", () => {
  const trial: ParseableTrial = {
    nctId: STUDY.nctId,
    briefTitle: STUDY.briefTitle,
    conditions: [],
    phases: [],
    eligibility: {
      criteriaText: TEXT,
      sex: "ALL",
      minimumAge: null,
      maximumAge: null,
      healthyVolunteers: null,
      stdAges: [],
    },
  };
  const parsed: ParsedCriteria & { criteriaSha256: string } = {
    nctId: STUDY.nctId,
    criteria: [
      {
        id: `${STUDY.nctId}:${SOURCES.P1.start}-${SOURCES.P1.end}`,
        polarity: "inclusion",
        type: "patient",
        text: "ECOG 0 or 1",
        source: SOURCES.P1,
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
    criteriaSha256: criteriaSha256(TEXT),
  };
  const agent = () =>
    new FakeModelAdapter([], {
      respond: (r) =>
        r.system === ASK_SYSTEM_PROMPT
          ? { kind: "json", content: { message: "How active are you day to day?" } }
          : { kind: "json", content: { readings: [] } },
    });
  const participant = () =>
    new FakeModelAdapter([], {
      respond: (r) =>
        r.user.startsWith("YOUR TEXT")
          ? { kind: "json", content: { message: "I play tennis.", quotes: ["playing tennis"] } }
          : { kind: "json", content: { faithful: true, reason: "" } },
    });

  it("runs the check from the arm's text to its close, with nothing carried", async () => {
    const p = participant();
    const t = await checkBenchmarkPair({
      pair: eligible,
      arm: "account",
      text: "I'm 60. Until recently I was still playing tennis.",
      trial,
      parsed,
      agent: agent(),
      participant: p,
      fidelity: p,
    });
    expect(t).toMatchObject({ arm: "account", parse: "parsed", label: "recommended" });
    expect(t.error).toBeUndefined();
    expect(t.replies.map((r) => r.turn)).toEqual(
      t.transcript.filter((x) => x.speaker === "participant").map((x) => x.index),
    );
    expect(t.replies[0]).toMatchObject({ quotes: ["playing tennis"], flags: [] });
    expect(t.findings.every((f) => f.earlier === undefined)).toBe(true);
    expect(p.requests[0]?.user).toContain("Until recently I was still playing tennis.");
  });

  it("records a trial with no parse as failed, without calling a model", async () => {
    const a = agent();
    const t = await checkBenchmarkPair({
      pair: eligible,
      arm: "full",
      text: "",
      trial,
      parsed: undefined,
      agent: a,
      participant: a,
      fidelity: a,
    });
    expect(t.parse).toBe("failed");
    expect(a.requests).toHaveLength(0);
  });
});
