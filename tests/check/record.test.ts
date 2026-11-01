import { describe, expect, it } from "vitest";
import {
  ASK_RECORDS,
  MAY_NOT_FIT,
  MAY_NOT_FIT_PART,
  NOTHING_CONFLICTS,
  recordFor,
  recordWithoutParse,
  type TrialRecord,
  WHY,
} from "../../src/check/record.js";
import type { FactMapping } from "../../src/facts/types.js";
import type {
  Finding,
  FindingReason,
  FindingStatus,
  ScreeningCriterion,
} from "../../src/screening/types.js";
import { oursIn, verdictHits } from "../../src/shortlist/words.js";

/**
 * The record is what a person takes to their oncologist. Pinned here: every
 * criterion in exactly one section, "may not fit" by polarity and by the
 * mapping's hint, no verdict field, and no verdict words in anything ours.
 */

const STUDY = { nctId: "NCT00000001", briefTitle: "A made-up trial" };

const crit = (
  id: string,
  polarity: ScreeningCriterion["polarity"],
  type: ScreeningCriterion["type"] = "patient",
): ScreeningCriterion => ({ id, polarity, type, text: `rule ${id}` });

const finding = (
  criterionId: string,
  status: FindingStatus,
  reason: FindingReason,
  extra: Partial<Finding> = {},
): Finding => ({ criterionId, status, reason, evidence: [], timesAsked: 0, ...extra });

const quote = (q: string) => [{ turn: 2, quote: q, reading: "holds" as const }];

// Every status, and every reason a record says something different about.
const CASES: Array<[ScreeningCriterion, Finding]> = [
  [
    crit("E1", "exclusion"),
    finding("E1", "from-conversation", "answered-earlier", {
      earlier: [
        {
          factId: "prior_pd1",
          answer: "progressed",
          words: "It grew on Keytruda.",
          question: "Asked before?",
          mayNotFit: true,
        },
      ],
    }),
  ],
  [
    crit("E2", "inclusion"),
    finding("E2", "from-conversation", "answered-earlier", {
      earlier: [
        {
          factId: "ecog",
          answer: "unknown",
          words: "No idea.",
          question: "Asked before?",
          mayNotFit: false,
        },
      ],
    }),
  ],
  [
    crit("T1", "exclusion"),
    finding("T1", "holds", "answered", { evidence: quote("Yes, last year") }),
  ],
  [
    crit("T2", "exclusion"),
    finding("T2", "does-not-hold", "answered", { evidence: quote("Never") }),
  ],
  [crit("T3", "inclusion"), finding("T3", "does-not-hold", "answered", { evidence: quote("No") })],
  [crit("T4", "inclusion"), finding("T4", "holds", "answered", { evidence: quote("I'm 64") })],
  [
    crit("C1", "exclusion", "clinical"),
    finding("C1", "chart-review", "answered", { reported: "holds", evidence: quote("I think so") }),
  ],
  [
    crit("C2", "inclusion", "clinical"),
    finding("C2", "chart-review", "unknown", { reported: "unknown" }),
  ],
  [crit("U1", "exclusion"), finding("U1", "unresolved", "unknown")],
  [crit("U2", "exclusion"), finding("U2", "unresolved", "declined")],
  [crit("U3", "exclusion"), finding("U3", "unresolved", "no-answer")],
  [crit("U4", "exclusion"), finding("U4", "unresolved", "contradicted")],
  [crit("U5", "exclusion"), finding("U5", "unresolved", "unclear")],
  [crit("U6", "inclusion"), finding("U6", "unresolved", "does-not-apply")],
  [crit("U7", "exclusion"), finding("U7", "unresolved", "evidence-not-found")],
  [crit("L1", "inclusion", "clinical"), finding("L1", "not-raised", "lab-value")],
  [crit("P1", "inclusion", "protocol"), finding("P1", "not-raised", "protocol")],
  [crit("D1", "inclusion", "definitional"), finding("D1", "not-raised", "definitional")],
];

const record = recordFor({
  study: STUDY,
  criteria: CASES.map(([c]) => c),
  findings: CASES.map(([, f]) => f),
  wording: new Map(CASES.map(([c]) => [c.id, `Verbatim ${c.id}.`])),
});

const sections = (r: TrialRecord) => [r.earlier, r.told, r.records, r.aboutTrial];
const where = (id: string) =>
  sections(record).find((s) => s.lines.some((l) => l.criterionId === id))?.heading;
const line = (id: string) =>
  sections(record)
    .flatMap((s) => s.lines)
    .find((l) => l.criterionId === id);

describe("recordFor", () => {
  it("puts every criterion in exactly one section", () => {
    const ids = sections(record).flatMap((s) => s.lines.map((l) => l.criterionId));
    expect([...ids].sort()).toEqual(CASES.map(([c]) => c.id).sort());
  });

  it("places each status where §5 says", () => {
    expect(record.earlier.lines.map((l) => l.criterionId)).toEqual(["E1", "E2"]);
    expect(record.told.lines.map((l) => l.criterionId)).toEqual(["T1", "T2", "T3", "T4"]);
    expect(record.records.lines.map((l) => l.criterionId)).toEqual([
      "C1",
      "C2",
      "U1",
      "U2",
      "U3",
      "U4",
      "U5",
      "U6",
      "U7",
      "L1",
    ]);
    expect(record.aboutTrial.lines.map((l) => l.criterionId)).toEqual(["P1", "D1"]);
    expect(record.aboutTrial.folded).toBe(true);
    expect(where("E1")).toEqual({ ours: "What your earlier answers covered" });
  });

  it("says may not fit when an exclusion holds or an inclusion doesn't, and only then", () => {
    expect(line("T1")?.mayNotFit).toBe(true);
    expect(line("T3")?.mayNotFit).toBe(true);
    expect(line("T2")?.mayNotFit).toBe(false);
    expect(line("T4")?.mayNotFit).toBe(false);
    expect(line("T1")?.flag).toEqual({ ours: MAY_NOT_FIT });
    expect(line("T2")?.flag).toEqual({ ours: NOTHING_CONFLICTS });
    expect(line("C1")?.mayNotFit).toBe(true);
    expect(line("C2")?.mayNotFit).toBe(false);
  });

  it("says a rule for one part of the trial may not fit that part, and still counts it (Gate 1 R3)", () => {
    const parted = recordFor({
      study: STUDY,
      criteria: CASES.map(([c]) => c),
      findings: CASES.map(([, f]) => f),
      parts: new Map([
        ["T1", "Part D"],
        ["T2", "Part D"],
      ]),
    });
    const of = (id: string) =>
      [parted.earlier, parted.told, parted.records, parted.aboutTrial]
        .flatMap((s) => s.lines)
        .find((l) => l.criterionId === id);
    expect(of("T1")).toMatchObject({
      mayNotFit: true,
      part: { registry: "Part D" },
      flag: { ours: MAY_NOT_FIT_PART },
    });
    expect(of("T2")).toMatchObject({
      part: { registry: "Part D" },
      flag: { ours: NOTHING_CONFLICTS },
    });
    expect(of("T3")?.part).toBeNull();
    expect(parted.counts.mayNotFit).toBe(record.counts.mayNotFit);
  });

  it("takes an earlier answer's hint from the mapping, and says when they didn't know", () => {
    expect(line("E1")).toMatchObject({ mayNotFit: true, said: [] });
    expect(line("E2")).toMatchObject({ mayNotFit: false, why: { ours: WHY.didntKnow } });
  });

  it("shows each earlier answer beside the question it answered (Gate 1 R2)", () => {
    expect(line("E1")?.earlier).toEqual([
      { asked: { ours: "Asked before?" }, said: { said: "It grew on Keytruda." } },
    ]);
    expect(line("T1")?.earlier).toEqual([]);
  });

  it("says why a rule needs records", () => {
    expect(line("C1")?.why).toEqual({ ours: WHY.chart });
    expect(line("U1")?.why).toEqual({ ours: WHY.didntKnow });
    expect(line("U2")?.why).toEqual({ ours: WHY.skipped });
    expect(line("U3")?.why).toEqual({ ours: WHY.notAsked });
    expect(line("U4")?.why).toEqual({ ours: WHY.contradicted });
    expect(line("U6")?.why).toEqual({ ours: WHY.notAboutYou });
    expect(line("L1")?.why).toEqual({ ours: WHY.labValue });
  });

  it("shows each rule in the trial's words, and the person's in theirs", () => {
    expect(line("T1")?.rule).toEqual({ registry: "Verbatim T1." });
    expect(line("T1")?.said).toEqual([{ said: "Yes, last year" }]);
  });

  it("counts, and asks the oncologist about every may-not-fit, every records rule, and every earlier don't-know", () => {
    expect(record.counts.mayNotFit).toBe(4);
    expect(record.counts.records).toBe(11);
    expect(record.toAsk.items).toHaveLength(4 + 10);
    expect(record.toAsk.items).toContainEqual({
      rule: line("E2")?.rule,
      question: { ours: ASK_RECORDS },
    });
  });

  it("has no field for a verdict, and no verdict words in anything ours", () => {
    const keys: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object" && v !== null)
        for (const [k, x] of Object.entries(v)) {
          keys.push(k);
          walk(x);
        }
    };
    walk(record);
    expect(keys.filter((k) => /eligib|qualif|verdict|ruled|fits$|decide/i.test(k))).toEqual([]);
    const words = oursIn(record);
    expect(words.length).toBeGreaterThan(20);
    expect(verdictHits(words)).toEqual([]);
  });
});

describe("recordWithoutParse", () => {
  const mappings: FactMapping[] = [
    {
      factId: "prior_pd1",
      rulesOut: ["progressed"],
      polarity: "exclusion",
      source: { start: 0, end: 5, text: "No PD-1." },
    },
    {
      factId: "ild",
      rulesOut: ["active"],
      polarity: "exclusion",
      source: { start: 6, end: 9, text: "No ILD." },
    },
  ];
  const r = recordWithoutParse(
    STUDY,
    mappings,
    new Map([
      ["prior_pd1", { answer: "progressed", words: "It grew.", question: "Asked before?" }],
    ]),
  );

  it("leads by saying the rules couldn't be read, and shows the mappings with the answers", () => {
    expect(r.lead).not.toBeNull();
    expect(r.earlier.lines).toEqual([
      expect.objectContaining({
        mayNotFit: true,
        rule: { registry: "No PD-1." },
        earlier: [{ asked: { ours: "Asked before?" }, said: { said: "It grew." } }],
      }),
    ]);
    expect(r.records.lines).toEqual([expect.objectContaining({ why: { ours: WHY.notAsked } })]);
    expect(verdictHits(oursIn(r))).toEqual([]);
  });
});
