import { describe, expect, it } from "vitest";
import { orderFor } from "../../src/questions/conversation.js";
import { oncologistSheet, type SheetInput, sheetMissing } from "../../src/shortlist/sheet.js";
import { oursIn, verdictHits } from "../../src/shortlist/words.js";
import { candidate, mapping, trialFacts, trials, vocabulary } from "../questions/fixture.js";

function sheet(profile: Record<string, string>, extra: Partial<SheetInput> = {}) {
  const input: SheetInput = {
    order: orderFor(trials(), profile, vocabulary, "read-first"),
    orderName: "read-first",
    shortlistSize: 3,
    profile,
    vocabulary,
    cancerType: "nsclc",
    asked: ["brain_mets", ...Object.keys(profile)],
    snapshotMonth: "2000-01",
    ...extra,
  };
  return { input, view: oncologistSheet(input) };
}

describe("oncologistSheet", () => {
  it("lists what was asked: the person's words, a choice, or not knowing", () => {
    const { view } = sheet({ hiv: "no", ecog: "ps1" }, { said: { hiv: "No, never." } });
    expect(view.answers.map((a) => [a.factId, a.said, a.answer])).toEqual([
      ["brain_mets", { ours: "Didn't know" }, { ours: "Not known yet" }],
      ["hiv", { said: "No, never." }, { ours: "No" }],
      ["ecog", { ours: "Chose from a list" }, { ours: expect.any(String) }],
    ]);
  });

  it("asks the short list's open questions, most trials first, with the count", () => {
    const { view } = sheet({});
    expect(view.questions.map((q) => [q.factId, q.trials])).toEqual([
      ["hiv", 2],
      ["ecog", 1],
      ["pregnant_or_breastfeeding", 1],
    ]);
    expect(view.questions[0]?.count).toEqual({ ours: "2 of these 3 trials ask about this." });
    expect(view.questions[1]?.count).toEqual({ ours: "1 of these 3 trials asks about this." });
  });

  it("says what to bring for the open questions records would answer", () => {
    const facts = trialFacts("NCT09", [
      mapping("egfr", ["common_sensitizing"]),
      mapping("kras", ["g12c"]),
      mapping("histology", ["squamous"]),
      mapping("hiv", ["uncontrolled"]),
    ]);
    const { view } = sheet(
      {},
      { order: orderFor([{ candidate: candidate("NCT09", 1), facts }], {}, vocabulary) },
    );
    expect(view.bring.map((b) => [b.item, b.answers.length])).toEqual([
      [{ ours: "The pathology report from your biopsy" }, 1],
      [{ ours: "The biomarker (genetic test) report on your tumor" }, 2],
    ]);
  });

  it("never mentions a fact skipped for the person's sex", () => {
    const { view } = sheet(
      {},
      {
        skipped: ["pregnant_or_breastfeeding"],
        asked: ["brain_mets", "pregnant_or_breastfeeding"],
      },
    );
    const ids = [...view.answers, ...view.questions].map((x) => x.factId);
    expect(ids).not.toContain("pregnant_or_breastfeeding");
  });

  it("carries each short-list trial's hints, in the trial's words", () => {
    const { view } = sheet({ hiv: "uncontrolled" });
    expect(view.trials).toHaveLength(3);
    expect(view.trials.flatMap((t) => t.hints).every((h) => "registry" in h.rule)).toBe(true);
  });

  it("misses no unknown, and states no verdict", () => {
    for (const profile of [{}, { hiv: "uncontrolled" }, { hiv: "no", ecog: "ps3_4" }]) {
      const { input, view } = sheet(profile);
      expect(sheetMissing(view, input.order.slice(0, 3))).toEqual([]);
      expect(verdictHits(oursIn(view))).toEqual([]);
    }
  });
});

describe("sheetMissing", () => {
  it("finds an unknown the sheet dropped", () => {
    const { input, view } = sheet({});
    const dropped = { ...view, questions: view.questions.filter((q) => q.factId !== "hiv") };
    expect(sheetMissing(dropped, input.order.slice(0, 3))).toEqual([
      { nctId: "NCT01", factId: "hiv" },
      { nctId: "NCT03", factId: "hiv" },
    ]);
  });
});

describe("a marked trial on the short list (slice 0005)", () => {
  it("keeps its card's line on the sheet", () => {
    const mark = {
      route: "small-cell" as const,
      cancers: ["small cell lung cancer"],
      evidence: ["SCLC"],
    };
    const input: SheetInput = {
      order: orderFor(
        trials().map((t) =>
          t.candidate.nctId === "NCT01" ? { ...t, candidate: { ...t.candidate, other: mark } } : t,
        ),
        {},
        vocabulary,
        "read-first",
      ),
      orderName: "read-first",
      shortlistSize: 3,
      profile: {},
      vocabulary,
      cancerType: "nsclc",
      asked: ["brain_mets"],
    };
    const sheet = oncologistSheet(input);
    const t = sheet.trials.find((x) => x.nctId === "NCT01");
    expect(t?.other?.lead).toEqual({
      ours: "This trial's record is about small cell lung cancer, a different kind of lung cancer from non-small cell. Ask your oncologist whether it takes people with your kind of lung cancer.",
    });
    expect(sheet.trials.filter((x) => x.nctId !== "NCT01").every((x) => x.other === null)).toBe(
      true,
    );
    expect(sheetMissing(sheet, input.order.slice(0, 3))).toEqual([]);
  });
});
