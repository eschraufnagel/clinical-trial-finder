import { describe, expect, it } from "vitest";
import type { Fact } from "../../src/facts/types.js";
import { FakeModelAdapter, type ScriptedResponse } from "../../src/models/fake.js";
import {
  READER_PROMPT_VERSION,
  READER_SYSTEM_PROMPT,
  readerSchema,
} from "../../src/questions/prompt.js";
import { readReply } from "../../src/questions/read.js";
import { vocabulary } from "./fixture.js";

const fact = vocabulary.facts.find((f) => f.id === "prior_pd1") as Fact;
const REPLY = "Keytruda, and it grew anyway.";

async function readWith(response: ScriptedResponse) {
  const adapter = new FakeModelAdapter([response]);
  return { reading: await readReply(fact, REPLY, adapter), adapter };
}

describe("readReply", () => {
  it("returns a valid answer id", async () => {
    const { reading } = await readWith({ kind: "json", content: { answer: "progressed" } });
    expect(reading).toEqual({ answer: "progressed" });
  });

  it("returns unknown when the model says so, with nothing rejected", async () => {
    const { reading } = await readWith({ kind: "json", content: { answer: "unknown" } });
    expect(reading).toEqual({ answer: "unknown" });
  });

  it("reads an id from another fact as unknown, and says why", async () => {
    const { reading } = await readWith({ kind: "json", content: { answer: "ps1" } });
    expect(reading).toEqual({ answer: "unknown", rejected: "ps1 isn't an answer to prior_pd1" });
  });

  it("reads truncated output as unknown", async () => {
    const { reading } = await readWith({
      kind: "json",
      content: { answer: "progressed" },
      finishReason: "length",
    });
    expect(reading).toEqual({ answer: "unknown", rejected: "the model's output was truncated" });
  });

  it("reads the wrong shape as unknown", async () => {
    const { reading } = await readWith({ kind: "json", content: ["progressed", "never"] });
    expect(reading.answer).toBe("unknown");
    expect(reading.rejected).toBe("the output has no answer string");
  });

  it("unwraps a one-element array", async () => {
    const { reading } = await readWith({ kind: "json", content: [{ answer: "never" }] });
    expect(reading).toEqual({ answer: "never" });
  });

  it("throws when the adapter fails, rather than calling it unknown", async () => {
    await expect(readWith({ kind: "raw", raw: "not json" })).rejects.toThrow(/not JSON/);
  });

  it("shows the model the question, its answers and the reply, and nothing else", async () => {
    const { adapter } = await readWith({ kind: "json", content: { answer: "progressed" } });
    const request = adapter.requests[0];
    expect(request?.system).toBe(READER_SYSTEM_PROMPT);
    expect(request?.user).toBe(
      [
        `Question: ${fact.question}`,
        "Answers:",
        ...fact.answers.map((a) => `- "${a.id}": ${a.words}`),
        '- "unknown": the reply doesn\'t say',
        "",
        `Reply: ${JSON.stringify(REPLY)}`,
      ].join("\n"),
    );
  });
});

describe("the reader's schema (slice 0006)", () => {
  it("allows the fact's ids and unknown, and nothing else", () => {
    expect(readerSchema(fact)).toEqual({
      type: "object",
      properties: {
        answer: { type: "string", enum: [...fact.answers.map((a) => a.id), "unknown"] },
      },
      required: ["answer"],
      additionalProperties: false,
    });
  });

  it("goes with every reading", async () => {
    const { adapter } = await readWith({ kind: "json", content: { answer: "progressed" } });
    expect(adapter.requests[0]?.schema).toEqual(readerSchema(fact));
  });

  // The schema isn't trusted: an id outside the fact still reads as unknown.
  it("leaves the reader's own checks in place", async () => {
    const { reading } = await readWith({ kind: "json", content: { answer: "adenocarcinoma" } });
    expect(reading).toEqual({
      answer: "unknown",
      rejected: "adenocarcinoma isn't an answer to prior_pd1",
    });
  });

  // The schema isn't part of the prompt's version, so the local model's
  // committed readings are still the readings of this version. A change to the
  // prompt's text or layout changes it, and has to change this line.
  it("leaves the prompt's version where it was", () => {
    expect(READER_PROMPT_VERSION).toBe("8cb01749dcc3");
  });
});
