import { describe, expect, expectTypeOf, it } from "vitest";
import type { TranscriptLine } from "../../evals/participant/simulate.js";
import {
  buildSummaryPrompt,
  simulateFromSummary,
  summaryFidelityCheck,
  summaryFlags,
} from "../../evals/participant/summary.js";
import { FakeModelAdapter, type ModelAdapter } from "../../src/models/index.js";
import type { Carried, Progress, ScreeningState } from "../../src/screening/types.js";

const TEXT = "I'm 60. I had chemo with carboplatin and paclitaxel.\nI have high blood pressure.";

describe("simulateFromSummary", () => {
  it("is blind to the agent and the arm: its inputs are a text, transcript lines and an adapter", () => {
    type Inputs = Parameters<typeof simulateFromSummary>[number];
    expectTypeOf<
      Extract<Inputs, ScreeningState | Progress | readonly Progress[] | Carried>
    >().toEqualTypeOf<never>();
    expectTypeOf<Parameters<typeof simulateFromSummary>>().toEqualTypeOf<
      [string, readonly TranscriptLine[], ModelAdapter]
    >();
  });

  it("shows the text and the numbered conversation", () => {
    const prompt = buildSummaryPrompt(TEXT, [{ speaker: "agent", text: "Any heart trouble?" }]);
    expect(prompt).toContain("YOUR TEXT:\nI'm 60.");
    expect(prompt).toContain('1. The tool said: "Any heart trouble?"');
  });

  it("returns the reply and its quotes, and retries one unusable reply", async () => {
    const adapter = new FakeModelAdapter([
      { kind: "json", content: { message: "" } },
      { kind: "json", content: { message: "Yes, carboplatin.", quotes: ["carboplatin"] } },
    ]);
    expect(await simulateFromSummary(TEXT, [], adapter)).toEqual({
      message: "Yes, carboplatin.",
      quotes: ["carboplatin"],
    });
    const bad = new FakeModelAdapter([
      { kind: "json", content: { quotes: [] } },
      { kind: "json", content: { message: "x", quotes: [] }, finishReason: "length" },
    ]);
    await expect(simulateFromSummary(TEXT, [], bad)).rejects.toThrow(/no usable reply/);
  });
});

describe("summaryFlags", () => {
  it("passes a quote from the text, whatever its case or line breaks", () => {
    expect(
      summaryFlags(TEXT, { message: "Yes.", quotes: ["CARBOPLATIN and paclitaxel. I have"] }),
    ).toEqual([]);
  });

  it("flags a quote that isn't in the text, and a long reply that quotes nothing", () => {
    expect(summaryFlags(TEXT, { message: "Yes.", quotes: ["docetaxel"] })).toEqual([
      { kind: "unknown-fact", facts: ["docetaxel"] },
    ]);
    const long =
      "I had my gallbladder out in 2015 and my knee replaced, and I take pills for blood pressure.";
    expect(summaryFlags(TEXT, { message: long, quotes: [] })).toEqual([
      { kind: "uncited-assertion", length: long.length },
    ]);
  });

  it("doesn't flag an honest don't-know, however long", () => {
    const message =
      "I really don't know about that one, nobody ever told me anything about it as far as I remember.";
    expect(summaryFlags(TEXT, { message, quotes: [] })).toEqual([]);
  });
});

describe("summaryFidelityCheck", () => {
  it("passes a faithful reply, and flags an unfaithful or unreadable one", async () => {
    const adapter = new FakeModelAdapter([
      { kind: "json", content: { faithful: true, reason: "" } },
      { kind: "json", content: { faithful: false, reason: "Invents surgery." } },
      { kind: "json", content: { nonsense: 1 } },
    ]);
    expect(await summaryFidelityCheck(TEXT, "Yes.", adapter)).toBeNull();
    expect(await summaryFidelityCheck(TEXT, "Yes.", adapter)).toEqual({
      kind: "model",
      reason: "Invents surgery.",
    });
    expect(await summaryFidelityCheck(TEXT, "Yes.", adapter)).toEqual({
      kind: "model",
      reason: "fidelity check returned no usable answer",
    });
    expect(adapter.requests[0]?.user).toContain("TEXT:\nI'm 60.");
  });
});
