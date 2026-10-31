import { describe, expect, it } from "vitest";
import { orderFor } from "../../src/questions/conversation.js";
import {
  askable,
  indexTrials,
  nextQuestion,
  rank,
  type Situation,
  shortlistChange,
  shortlistChangeByRecount,
} from "../../src/questions/select.js";
import { ORDER_NAMES } from "../../src/shortlist/order.js";
import { SETTINGS, trials, vocabulary } from "./fixture.js";

function situation(overrides: Partial<Situation> = {}): Situation {
  const input = trials();
  return {
    index: indexTrials(input, vocabulary, "nsclc"),
    order: orderFor(input, {}, vocabulary),
    profile: {},
    asked: new Set(),
    excluded: new Set(SETTINGS.intake),
    skip: SETTINGS.skip,
    sex: "female",
    shortlistSize: SETTINGS.shortlistSize,
    ordering: "hints",
    followUps: 0,
    budget: 10,
    ...overrides,
  };
}

describe("askable", () => {
  it("is the facts some trial maps, less those asked, excluded or skipped", () => {
    expect(askable(situation()).map((f) => f.id)).toEqual([
      "ecog",
      "hiv",
      "pregnant_or_breastfeeding",
    ]);
    expect(askable(situation({ asked: new Set(["hiv"]) })).map((f) => f.id)).toEqual([
      "ecog",
      "pregnant_or_breastfeeding",
    ]);
    expect(askable(situation({ sex: "male" })).map((f) => f.id)).toEqual(["ecog", "hiv"]);
    expect(askable(situation({ excluded: new Set(["ecog"]) })).map((f) => f.id)).toEqual([
      "hiv",
      "pregnant_or_breastfeeding",
    ]);
  });
});

describe("the scorers", () => {
  it("choose differently on the fixture", () => {
    const s = situation();
    expect(rank(s, "fixed").map((r) => r.factId)).toEqual([
      "ecog",
      "hiv",
      "pregnant_or_breastfeeding",
    ]);
    expect(rank(s, "count").map((r) => [r.factId, r.score])).toEqual([
      ["pregnant_or_breastfeeding", 4],
      ["hiv", 2],
      ["ecog", 1],
    ]);
    // hiv: 0, 2, 2 over its three answers; pregnancy and ECOG average 0.5, and
    // pregnancy is mapped by more trials.
    expect(rank(s, "shortlist").map((r) => [r.factId, r.score])).toEqual([
      ["hiv", 4 / 3],
      ["pregnant_or_breastfeeding", 0.5],
      ["ecog", 0.5],
    ]);
  });
});

/** The fixture with NCT02, on the short list by distance, marked as about other cancers only (slice 0005). */
function markedTrials() {
  return trials().map((t) =>
    t.candidate.nctId === "NCT02"
      ? {
          ...t,
          candidate: {
            ...t.candidate,
            other: {
              route: "listing" as const,
              cancers: ["prostate cancer"],
              evidence: ["Prostate Cancer"],
            },
          },
        }
      : t,
  );
}

describe("shortlistChange", () => {
  const profiles = [{}, { hiv: "no" }, { ecog: "ps2" }, { pregnant_or_breastfeeding: "no" }];

  it("matches reordering every trial, for every order, fact and answer", () => {
    for (const ordering of ORDER_NAMES) {
      const input = ordering === "other-last" ? markedTrials() : trials();
      for (const profile of profiles) {
        const order = orderFor(input, profile, vocabulary, ordering);
        const s = situation({ profile, order, ordering });
        const before = s.order.slice(0, 3).map((e) => e.candidate.nctId);
        for (const fact of askable(s)) {
          if (profile[fact.id as keyof typeof profile] !== undefined) continue;
          for (const answer of fact.answers) {
            const after = orderFor(
              input,
              { ...profile, [fact.id]: answer.id },
              vocabulary,
              ordering,
            )
              .slice(0, 3)
              .map((e) => e.candidate.nctId);
            expect(
              shortlistChange(s, fact.id, answer.id),
              `${ordering}: ${fact.id}=${answer.id}`,
            ).toBe(after.filter((id) => !before.includes(id)).length);
          }
        }
      }
    }
  });

  it("recounts to what the shortcut gives, under the orders the shortcut serves", () => {
    for (const ordering of ["hints", "read-first", "other-last"] as const) {
      const input = ordering === "other-last" ? markedTrials() : trials();
      for (const profile of profiles) {
        const order = orderFor(input, profile, vocabulary, ordering);
        const s = situation({ profile, order, ordering });
        for (const fact of askable(s)) {
          for (const answer of fact.answers) {
            expect(shortlistChangeByRecount(s, fact.id, answer.id)).toBe(
              shortlistChange(s, fact.id, answer.id),
            );
          }
        }
      }
    }
  });

  it("under checked, counts trials an answer moves up, which hints never does", () => {
    // Pregnancy "no": NCT02 and NCT04 to NCT06 map pregnancy and don't rule
    // "no" out, so each gains a fact checked, and NCT04 and NCT05 rise into
    // the short list past NCT01 and NCT03.
    const input = trials();
    const checked = situation({
      order: orderFor(input, {}, vocabulary, "checked"),
      ordering: "checked",
    });
    expect(shortlistChange(checked, "pregnant_or_breastfeeding", "no")).toBe(2);
    expect(shortlistChange(situation(), "pregnant_or_breastfeeding", "no")).toBe(0);
  });
});

describe("nextQuestion", () => {
  it("stops at the budget first", () => {
    expect(nextQuestion(situation({ followUps: 10 }), "shortlist")).toEqual({ stop: "budget" });
  });

  it("stops when nothing is left to ask", () => {
    const asked = new Set(["ecog", "hiv", "pregnant_or_breastfeeding"]);
    expect(nextQuestion(situation({ asked }), "fixed")).toEqual({ stop: "nothing-left" });
  });

  it("stops `shortlist` when no answer could change the short list, but not the others", () => {
    // A short list of all eight trials: no answer can push one out of it.
    const asked = new Set(["ecog", "hiv"]);
    const s = situation({ asked, shortlistSize: 8 });
    expect(nextQuestion(s, "shortlist")).toEqual({ stop: "stable" });
    expect(nextQuestion(s, "fixed")).toEqual({ factId: "pregnant_or_breastfeeding", score: 29 });
  });
});
