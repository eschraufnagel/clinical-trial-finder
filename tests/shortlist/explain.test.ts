import { describe, expect, it } from "vitest";
import { factsFor } from "../../src/facts/vocabulary.js";
import { orderFor } from "../../src/questions/conversation.js";
import {
  type DescribeInput,
  describeOrder,
  describeTrial,
  milesWords,
  THIN_READ,
  THIN_WORDS,
} from "../../src/shortlist/explain.js";
import { phaseWords } from "../../src/shortlist/phase.js";
import { candidate, mapping, trialFacts, trials, vocabulary } from "../questions/fixture.js";

const TOTAL = factsFor(vocabulary, "nsclc").length;

function view(profile: Record<string, string>, extra: Partial<DescribeInput> = {}) {
  return describeOrder({
    order: orderFor(trials(), profile, vocabulary, "read-first"),
    orderName: "read-first",
    shortlistSize: 3,
    profile,
    vocabulary,
    cancerType: "nsclc",
    ...extra,
  });
}

const trialIn = (v: ReturnType<typeof view>, nctId: string) =>
  [...v.shortlist, ...v.rest].find((t) => t.nctId === nctId);

describe("describeOrder", () => {
  it("describes every trial the search kept exactly once, short list first", () => {
    const v = view({});
    const ids = [...v.shortlist, ...v.rest].map((t) => t.nctId);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(v.shortlist).toHaveLength(3);
    expect(v.restHeading).toEqual({ ours: "5 more trials the search kept, in the same order" });
  });

  it("says how much of each trial's rules were read, including none", () => {
    const v = view({});
    expect(trialIn(v, "NCT01")?.read).toEqual({
      ours: `Its rules were read for 2 of the ${TOTAL} questions here.`,
    });
    expect(trialIn(v, "NCT07")?.read).toEqual({
      ours: "None of this trial's rules could be matched to the questions here. Ask about it like any other.",
    });
    expect(trialIn(v, "NCT08")?.read).toEqual({
      ours: "This tool couldn't read this trial's rules. Ask about it like any other.",
    });
  });

  it("leads a thinly read trial with a plain line, and no other (0004 Gate 3)", () => {
    expect(THIN_READ).toBeCloseTo(1 / 3);
    const v = view({});
    // NCT01 maps 2 of the questions: thin. NCT07 maps none, NCT08 isn't in the run: their own line.
    expect(trialIn(v, "NCT01")?.thin).toEqual({ ours: THIN_WORDS });
    expect(trialIn(v, "NCT07")?.thin).toBeNull();
    expect(trialIn(v, "NCT08")?.thin).toBeNull();
    // A trial read for a third of the questions or more isn't thin.
    const many = factsFor(vocabulary, "nsclc")
      .slice(0, Math.ceil(TOTAL / 3))
      .map((f) => mapping(f.id, [f.answers[0]?.id ?? ""]));
    const wellRead = describeTrial(
      {
        candidate: candidate("NCT09", 1),
        status: {
          nctId: "NCT09",
          hints: [],
          partHints: [],
          fits: [],
          unknown: many.map((m) => m.factId),
        },
      },
      {
        order: [],
        orderName: "read-first",
        shortlistSize: 3,
        profile: {},
        vocabulary,
        cancerType: "nsclc",
      },
    );
    expect(wellRead.thin).toBeNull();
  });

  it("lists what the answers checked, with the person's own words", () => {
    const v = view({ hiv: "no" }, { said: { hiv: "No, never had it." } });
    const checked = trialIn(v, "NCT01")?.checked;
    expect(checked).toHaveLength(1);
    expect(checked?.[0]).toMatchObject({
      factId: "hiv",
      answer: { ours: "No" },
      said: { said: "No, never had it." },
    });
  });

  it("shows a hint with the trial's rule in its own words, and the person's answer", () => {
    const t = trialIn(view({ hiv: "uncontrolled" }), "NCT01");
    expect(t?.hints).toHaveLength(1);
    expect(t?.hints[0]?.rule).toEqual({ registry: "rule on hiv" });
    expect(t?.hints[0]?.part).toBeNull();
    expect(t?.hintNote).toMatchObject({ ours: expect.stringMatching(/^May not fit:/) });
    expect(t?.checked.map((c) => c.factId)).not.toContain("hiv");
  });

  it("names the part of a trial a part hint is for", () => {
    const entry = {
      candidate: candidate("NCT09", 3),
      status: {
        nctId: "NCT09",
        hints: [],
        partHints: [mapping("ecog", ["ps2"], "Cohort B")],
        fits: [],
        unknown: ["ecog"],
      },
    };
    const t = describeTrial(entry, {
      order: [entry],
      orderName: "read-first",
      shortlistSize: 3,
      profile: { ecog: "ps2" },
      vocabulary,
      cancerType: "nsclc",
    });
    expect(t.hints[0]?.part).toEqual({ registry: "Cohort B" });
    expect(t.unknown).toEqual([]);
  });

  it("groups what's still unknown by who would know, leaving out answered and skipped facts", () => {
    const facts = trialFacts("NCT09", [
      mapping("egfr", ["common_sensitizing"]),
      mapping("histology", ["squamous"]),
      mapping("hiv", ["uncontrolled"]),
      mapping("pregnant_or_breastfeeding", ["yes"]),
    ]);
    const order = orderFor(
      [{ candidate: candidate("NCT09", 1), facts }],
      { hiv: "no" },
      vocabulary,
      "read-first",
    );
    const v = describeOrder({
      order,
      orderName: "read-first",
      shortlistSize: 3,
      profile: { hiv: "no" },
      vocabulary,
      cancerType: "nsclc",
      skipped: ["pregnant_or_breastfeeding"],
    });
    expect(v.shortlist[0]?.unknown).toEqual([
      {
        who: "oncologist",
        heading: { ours: "Your oncologist would know" },
        facts: [{ factId: "histology", question: expect.anything() }],
      },
      {
        who: "records",
        heading: { ours: "In your records" },
        facts: [{ factId: "egfr", question: expect.anything() }],
      },
    ]);
  });

  it("words the record's flags, the site and the phase, and links the full record", () => {
    const c = { ...candidate("NCT09", null), flags: ["stale-record" as const] };
    const t = describeTrial(
      { candidate: c, status: null },
      {
        order: [],
        orderName: "read-first",
        shortlistSize: 3,
        profile: {},
        vocabulary,
        cancerType: "nsclc",
      },
    );
    expect(t.flags).toEqual([
      { ours: "This record hasn't been updated in over a year. It may not be enrolling." },
    ]);
    expect(t.site).toEqual({ ours: "Nearest site: not named, distance not known." });
    expect(t.phase).toEqual({ ours: phaseWords(["PHASE2"]) });
    expect(t.link.href).toBe("https://clinicaltrials.gov/study/NCT09");
    expect(t.title).toEqual({ registry: "Trial NCT09" });
  });
});

describe("milesWords", () => {
  it("says one mile, many miles, under a mile, or not known", () => {
    expect(milesWords(1)).toBe("1 mile away");
    expect(milesWords(12)).toBe("12 miles away");
    expect(milesWords(0)).toBe("under a mile away");
    expect(milesWords(null)).toBe("distance not known");
  });
});

describe("phaseWords", () => {
  it("has a sentence for the registry's phases, and falls back to the registry's words", () => {
    expect(phaseWords(["PHASE1", "PHASE2"])).toMatch(/^Phase 1\/2:/);
    expect(phaseWords(["PHASE3", "PHASE4"])).toBe(
      "Phase: PHASE3, PHASE4, as the registry gives it.",
    );
    expect(phaseWords([])).toBe("Phase: not given, as the registry gives it.");
  });
});

describe("a trial the search marked (slice 0005)", () => {
  const mark = {
    route: "rules" as const,
    cancers: ["prostate cancer"],
    evidence: ["Histologically confirmed   adenocarcinoma of the prostate."],
  };
  const marked = () =>
    trials().map((t) =>
      t.candidate.nctId === "NCT02" ? { ...t, candidate: { ...t.candidate, other: mark } } : t,
    );
  const otherView = () =>
    describeOrder({
      order: orderFor(marked(), {}, vocabulary, "other-last"),
      orderName: "other-last",
      shortlistSize: 3,
      profile: {},
      vocabulary,
      cancerType: "nsclc",
    });

  it("says first what its record names, with the record's words, and sorts it last", () => {
    const v = otherView();
    const t = [...v.shortlist, ...v.rest].at(-1);
    expect(t?.nctId).toBe("NCT02");
    expect(t?.other).toEqual({
      lead: {
        ours: "This trial's record names other cancers: prostate cancer. Non-small cell lung cancer isn't among them. Ask your oncologist whether it takes people with your kind of lung cancer.",
      },
      evidence: [{ registry: "Histologically confirmed adenocarcinoma of the prostate." }],
    });
  });

  it("says nothing of the kind about an unmarked trial", () => {
    expect([...view({}).shortlist, ...view({}).rest].every((t) => t.other === null)).toBe(true);
  });
});
