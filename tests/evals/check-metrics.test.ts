import { describe, expect, it } from "vitest";
import { scorePair, summarize } from "../../evals/check/metrics.js";
import type { PairLabel } from "../../evals/check/pairs.js";
import {
  type CheckEvalResult,
  regradeProblems,
  scoreTranscripts,
} from "../../evals/check/result.js";
import type { PairTranscript } from "../../evals/check/transcript.js";
import { recordFor } from "../../src/check/record.js";
import { fixedQuestion } from "../../src/screening/templates.js";
import type { Finding, ScreeningCriterion, Turn } from "../../src/screening/types.js";

/**
 * Each measure on hand-made transcripts: a repeat, a catch by each route, a
 * miss of each kind, a false alarm, a finding excluded for an unfaithful
 * reply, and the regrade `--check` runs.
 */

const TEXT = "Age 18 or older. Prior immunotherapy is not allowed. Adequate organ function.";
const span = (quote: string) => {
  const start = TEXT.indexOf(quote);
  return { start, end: start + quote.length, text: quote };
};
const RULE = "Prior immunotherapy is not allowed.";
/** The made-up patient's known facts. */
const KNOWS: ReadonlySet<string> = new Set(["prior_pd1"]);

const CRITERIA: ScreeningCriterion[] = [
  { id: "P1", polarity: "inclusion", type: "patient", text: "Age 18 or older" },
  { id: "P2", polarity: "exclusion", type: "patient", text: "Prior immunotherapy" },
  { id: "P3", polarity: "inclusion", type: "clinical", text: "Adequate organ function" },
];
const SOURCES = {
  P1: span("Age 18 or older."),
  P2: span(RULE),
  P3: span("Adequate organ function."),
};

const finding = (
  criterionId: string,
  status: Finding["status"],
  extra: Partial<Finding> = {},
): Finding => ({
  criterionId,
  status,
  reason: status === "from-conversation" ? "answered-earlier" : "answered",
  evidence: [],
  timesAsked: 0,
  ...extra,
});

const TURNS: Turn[] = [
  { index: 0, speaker: "agent", kind: "opening", text: "Opening." },
  {
    index: 1,
    speaker: "agent",
    kind: "question",
    text: "Have you had immunotherapy?",
    criterionId: "P2",
  },
  { index: 2, speaker: "participant", kind: "reply", text: "Yes, Keytruda." },
  { index: 3, speaker: "agent", kind: "closing", text: "Closing." },
];

function transcript(findings: Finding[], extra: Partial<PairTranscript> = {}): PairTranscript {
  return {
    patient: "p99",
    nctId: "NCT00000001",
    set: "dev",
    rank: 1,
    conversation: {
      prior_pd1: { answer: "progressed", words: "Keytruda, it grew.", question: "Asked before?" },
    },
    parse: "parsed",
    criteria: CRITERIA,
    sources: SOURCES,
    links: {},
    carried: {},
    findings,
    transcript: TURNS,
    rejectedReadings: [],
    ignoredReadings: [],
    replies: [{ turn: 2, usedFacts: ["prior_pd1"], flags: [] }],
    record: recordFor({
      study: { nctId: "NCT00000001", briefTitle: "Made up" },
      criteria: CRITERIA,
      findings,
    }),
    orderBefore: ["A", "B"],
    orderAfter: ["A", "B"],
    calls: { agent: 3, participant: 1, fidelity: 1 },
    run: null,
    ...extra,
  };
}

const ruledOut: PairLabel = {
  patient: "p99",
  nctId: "NCT00000001",
  set: "dev",
  clearlyRuledOut: true,
  rule: { quote: RULE, facts: ["prior_pd1"], why: "made up" },
};
const notRuledOut: PairLabel = {
  patient: "p99",
  nctId: "NCT00000001",
  set: "dev",
  clearlyRuledOut: false,
};

const carriedP2 = finding("P2", "from-conversation", {
  earlier: [
    {
      factId: "prior_pd1",
      answer: "progressed",
      words: "Keytruda, it grew.",
      question: "Asked before?",
      mayNotFit: true,
    },
  ],
});
const askedP2 = finding("P2", "holds", { evidence: [{ turn: 2, quote: "Yes", reading: "holds" }] });
const p1 = finding("P1", "holds", { evidence: [{ turn: 2, quote: "Yes", reading: "holds" }] });
const p3 = finding("P3", "not-raised", { reason: "lab-value" });

describe("scorePair", () => {
  it("counts what the conversation saved, the questions asked, and a repeat by the participant's report", () => {
    const row = scorePair(transcript([p1, carriedP2, p3]), ruledOut, TEXT, KNOWS);
    expect(row.saved).toBe(1);
    expect(row.raisable).toBe(2);
    expect(row.asked).toBe(1);
    expect(row.repeats).toEqual([{ turn: 1, facts: ["prior_pd1"] }]);
  });

  it("catches the labelled rule by the carried route and by the asked route", () => {
    expect(scorePair(transcript([p1, carriedP2, p3]), ruledOut, TEXT, KNOWS).caught).toEqual({
      route: "carried",
      criterionId: "P2",
    });
    expect(scorePair(transcript([p1, askedP2, p3]), ruledOut, TEXT, KNOWS).caught).toEqual({
      route: "asked",
      criterionId: "P2",
    });
  });

  it("names why a ruled-out pair was missed", () => {
    const missed = (t: PairTranscript) => scorePair(t, ruledOut, TEXT, KNOWS).missed;
    const { P2: _p2, ...noP2 } = SOURCES;
    expect(missed(transcript([p1, askedP2, p3], { sources: noP2 }))).toBe("not-parsed");
    expect(missed(transcript([p1, finding("P2", "unresolved", { reason: "unknown" }), p3]))).toBe(
      "unknown-or-records",
    );
    expect(
      missed(
        transcript([
          p1,
          finding("P2", "does-not-hold", {
            evidence: [{ turn: 2, quote: "No", reading: "does-not-hold" }],
          }),
          p3,
        ]),
      ),
    ).toBe("no-conflict");
    const protocol = CRITERIA.map((c) => (c.id === "P2" ? { ...c, type: "protocol" as const } : c));
    const t = transcript([p1, finding("P2", "not-raised", { reason: "protocol" }), p3]);
    t.record = recordFor({
      study: { nctId: "NCT00000001", briefTitle: "Made up" },
      criteria: protocol,
      findings: t.findings,
    });
    expect(missed(t)).toBe("about-the-trial");
    const unfaithful = transcript([p1, askedP2, p3], {
      replies: [{ turn: 2, usedFacts: [], flags: [{ kind: "model", reason: "invented" }] }],
    });
    expect(missed(unfaithful)).toBe("unfaithful");
    expect(scorePair(unfaithful, ruledOut, TEXT, KNOWS).excluded).toEqual(["P1", "P2"]);
  });

  it("lists every may-not-fit on a pair not clearly ruled out as a false alarm", () => {
    expect(scorePair(transcript([p1, askedP2, p3]), notRuledOut, TEXT, KNOWS).falseAlarms).toEqual([
      "P2",
    ]);
    expect(scorePair(transcript([p1, askedP2, p3]), ruledOut, TEXT, KNOWS).falseAlarms).toEqual([]);
  });

  it("checks never a verdict, every unknown on the record, and the order unmoved", () => {
    const t = transcript([p1, finding("P2", "unresolved", { reason: "unknown" }), p3], {
      orderAfter: ["B", "A"],
    });
    t.transcript = [
      ...TURNS,
      { index: 4, speaker: "agent", kind: "closing", text: "You are eligible." },
    ];
    t.record = { ...t.record, records: { ...t.record.records, lines: [] } };
    const row = scorePair(t, notRuledOut, TEXT, KNOWS);
    expect(row.verdictHits).toEqual(["You are eligible."]);
    expect(row.unknownsMissing).toEqual(["P2"]);
    expect(row.orderMoved).toBe(true);
  });

  it("scans a fixed question's template, not the trial's words it quotes", () => {
    const eligible: ScreeningCriterion = {
      id: "P2",
      polarity: "exclusion",
      type: "patient",
      text: "Not eligible for immunotherapy",
    };
    const t = transcript([p1, askedP2, p3], {
      criteria: CRITERIA.map((c) => (c.id === "P2" ? eligible : c)),
    });
    t.transcript = TURNS.map((x) => (x.index === 1 ? { ...x, text: fixedQuestion(eligible) } : x));
    expect(scorePair(t, notRuledOut, TEXT, KNOWS).verdictHits).toEqual([]);
    t.transcript = TURNS.map((x) =>
      x.index === 1 ? { ...x, text: "Are you eligible for immunotherapy?" } : x,
    );
    expect(scorePair(t, notRuledOut, TEXT, KNOWS).verdictHits).toEqual([
      "Are you eligible for immunotherapy?",
    ]);
  });
});

describe("the patient's knowledge (Gate 1 R4)", () => {
  const carriedUnknown = finding("P2", "from-conversation", {
    earlier: [
      {
        factId: "prior_pd1",
        answer: "unknown",
        words: "I'm not sure.",
        question: "Asked before?",
        mayNotFit: false,
      },
    ],
  });

  it("marks a ruled-out pair knowable when the patient knows every fact its label turns on", () => {
    const t = transcript([p1, askedP2, p3]);
    expect(scorePair(t, ruledOut, TEXT, KNOWS).knowable).toBe(true);
    expect(scorePair(t, ruledOut, TEXT, new Set()).knowable).toBe(false);
    expect(scorePair(t, notRuledOut, TEXT, KNOWS).knowable).toBeNull();
    const searchOnly = { ...ruledOut, rule: { quote: RULE, facts: [], why: "made up" } };
    expect(scorePair(t, searchOnly, TEXT, new Set()).knowable).toBe(true);
  });

  it("misses a rule the conversation's don't-know covered as unknown, not no conflict", () => {
    expect(scorePair(transcript([p1, carriedUnknown, p3]), ruledOut, TEXT, KNOWS).missed).toBe(
      "unknown-or-records",
    );
  });

  it("reports caught among the knowable beside caught of all", () => {
    const s = summarize([
      scorePair(transcript([p1, carriedP2, p3]), ruledOut, TEXT, KNOWS),
      scorePair(transcript([p1, carriedUnknown, p3]), ruledOut, TEXT, new Set()),
    ]);
    expect(s).toMatchObject({ ruledOut: 2, caught: 1, knowable: 1, caughtKnowable: 1 });
    expect(s.caughtKnowableInterval[0]).toBeGreaterThan(0);
  });
});

describe("summarize", () => {
  it("adds the rows up, with intervals on the two rates", () => {
    const rows = [
      scorePair(transcript([p1, carriedP2, p3]), ruledOut, TEXT, KNOWS),
      scorePair(transcript([p1, askedP2, p3]), notRuledOut, TEXT, KNOWS),
    ];
    const s = summarize(rows);
    expect(s).toMatchObject({
      pairs: 2,
      saved: 1,
      raisable: 4,
      ruledOut: 1,
      caught: 1,
      notRuledOut: 1,
      falseAlarmPairs: 1,
      repeats: 2,
    });
    expect(s.caughtBy).toEqual({ carried: 1, asked: 0 });
    expect(s.caughtInterval[0]).toBeGreaterThan(0);
  });
});

describe("regradeProblems", () => {
  const t = transcript([p1, carriedP2, p3]);
  const labels = { version: 1 as const, pairs: [ruledOut] };
  const { rows, summary } = scoreTranscripts(
    [t],
    labels,
    () => TEXT,
    () => KNOWS,
  );
  const committed = {
    set: "dev",
    labelsSha256: "abc",
    rows,
    summary,
  } as unknown as CheckEvalResult;

  it("passes when the transcripts regrade to the committed rows", () => {
    expect(
      regradeProblems(
        committed,
        [t],
        labels,
        "abc",
        () => TEXT,
        () => KNOWS,
      ),
    ).toEqual([]);
  });

  it("names a changed label file, and rows that no longer follow", () => {
    expect(
      regradeProblems(
        committed,
        [t],
        labels,
        "def",
        () => TEXT,
        () => KNOWS,
      ),
    ).toEqual(["labelsSha256 differs"]);
    expect(
      regradeProblems(
        committed,
        [t],
        { version: 1, pairs: [notRuledOut] },
        "abc",
        () => TEXT,
        () => KNOWS,
      ),
    ).toEqual(["rows differ, first at p99 NCT00000001", "summary differs"]);
  });
});
