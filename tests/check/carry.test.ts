import { describe, expect, it } from "vitest";
import { carriedFor } from "../../src/check/carry.js";
import type { LinkedFact } from "../../src/check/link.js";

/** A criterion is carried only when every fact on it was asked; "I don't know" counts. */

const linked = (factId: string, rulesOut: string[]): LinkedFact => ({
  factId,
  rulesOut,
  polarity: "exclusion",
  source: { start: 0, end: 1, text: "x" },
});

const answers = new Map([
  [
    "prior_pd1",
    { answer: "progressed", words: "Keytruda, and it grew anyway.", question: "Asked before?" },
  ],
  ["ecog", { answer: "unknown", words: "Not sure what they wrote.", question: "Asked before?" }],
]);

describe("carriedFor", () => {
  it("carries a criterion whose every fact was asked, with the person's words", () => {
    const carried = carriedFor(new Map([["P1", [linked("prior_pd1", ["progressed"])]]]), answers);
    expect(carried).toEqual({
      P1: [
        {
          factId: "prior_pd1",
          answer: "progressed",
          words: "Keytruda, and it grew anyway.",
          question: "Asked before?",
          mayNotFit: true,
        },
      ],
    });
  });

  it("carries an unknown, which never may-not-fit", () => {
    const carried = carriedFor(new Map([["P1", [linked("ecog", ["ps2", "ps3_4"])]]]), answers);
    expect(carried["P1"]).toEqual([
      {
        factId: "ecog",
        answer: "unknown",
        words: "Not sure what they wrote.",
        question: "Asked before?",
        mayNotFit: false,
      },
    ]);
  });

  it("leaves a criterion open when any of its facts wasn't asked", () => {
    const carried = carriedFor(
      new Map([["P1", [linked("prior_pd1", ["progressed"]), linked("ild", ["active"])]]]),
      answers,
    );
    expect(carried).toEqual({});
  });

  it("carries nothing for a criterion with no facts", () => {
    expect(carriedFor(new Map([["P1", []]]), answers)).toEqual({});
  });

  it("keeps one entry per fact, and either mapping's hint", () => {
    const carried = carriedFor(
      new Map([["P1", [linked("prior_pd1", []), linked("prior_pd1", ["progressed"])]]]),
      answers,
    );
    expect(carried["P1"]).toHaveLength(1);
    expect(carried["P1"]?.[0]?.mayNotFit).toBe(true);
  });
});
