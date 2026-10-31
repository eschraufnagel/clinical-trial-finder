import { describe, expect, it } from "vitest";
import { orderFor } from "../../src/questions/conversation.js";
import { ROUTES } from "../../src/search/other.js";
import {
  describeOrder,
  FLAG_WORDS,
  ORDER_WORDS,
  otherWords,
  WHO_WORDS,
} from "../../src/shortlist/explain.js";
import { ORDER_NAMES } from "../../src/shortlist/order.js";
import { PHASE_WORDS } from "../../src/shortlist/phase.js";
import {
  oursIn,
  registry,
  said,
  VERDICT_PATTERNS,
  verdictHits,
} from "../../src/shortlist/words.js";
import { trials, vocabulary } from "../questions/fixture.js";

/**
 * Never a verdict (spec 0004 §7), on the fixture. Over all 20 made-up
 * patients the same scan runs in `questions:eval`, whose rows record it.
 */
describe("the words this project writes", () => {
  it("state no verdict, in any view of the fixture, under any order", () => {
    const profiles = [{}, { hiv: "uncontrolled" }, { hiv: "no", ecog: "ps2" }];
    for (const orderName of ORDER_NAMES) {
      for (const profile of profiles) {
        const view = describeOrder({
          order: orderFor(trials(), profile, vocabulary, orderName),
          orderName,
          shortlistSize: 3,
          profile,
          said: { hiv: "Am I eligible? I don't have HIV." },
          vocabulary,
          cancerType: "nsclc",
        });
        expect(oursIn(view).length).toBeGreaterThan(20);
        expect(verdictHits(oursIn(view))).toEqual([]);
      }
    }
  });

  it("state none in any fixed sentence, whether or not a view uses it", () => {
    const fixed = [
      ...Object.values(ORDER_WORDS),
      ...Object.values(FLAG_WORDS),
      ...Object.values(WHO_WORDS),
      ...Object.values(PHASE_WORDS),
      ...vocabulary.facts.flatMap((f) => [f.question, ...f.answers.map((a) => a.words)]),
      ...ROUTES.map((route) =>
        otherWords({ route, cancers: ["prostate cancer", "lymphoma"], evidence: [] }),
      ),
    ];
    expect(verdictHits(fixed)).toEqual([]);
  });
});

describe("the scan", () => {
  it("catches a sentence written to break each pattern", () => {
    const breaking = [
      "You are eligible for this trial.",
      "You may qualify.",
      "You fit this study.",
      "This trial fits you.",
      "It matches you well.",
      "A strong match.",
      "You should ask to join.",
      "You must enrol soon.",
      "We recommend this one.",
      "Recommended for you.",
      "Consider joining it.",
      "The best option near you.",
      "Your top match.",
      "You can join this trial.",
      "You are able to join it.",
      "You'd be accepted.",
      "The right trial for you.",
    ];
    expect(breaking).toHaveLength(VERDICT_PATTERNS.length);
    for (const [i, pattern] of VERDICT_PATTERNS.entries()) {
      expect(pattern.test(breaking[i] ?? ""), String(pattern)).toBe(true);
    }
  });

  it("reads only the project's own words, never the trial's or the person's", () => {
    const view = {
      a: registry("Patients eligible for surgery"),
      b: said("Do I qualify?"),
      c: [{ ours: "Nothing here says." }],
    };
    expect(oursIn(view)).toEqual(["Nothing here says."]);
  });
});
