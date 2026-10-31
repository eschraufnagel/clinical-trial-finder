import { describe, expect, expectTypeOf, it } from "vitest";
import {
  buildPatientPrompt,
  freshMemory,
  patientFlags,
  simulatePatient,
} from "../../evals/participant/patient.js";
import type { Patient } from "../../evals/questions/patients.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { FakeModelAdapter } from "../../src/models/index.js";
import type { Carried, Progress, ScreeningState } from "../../src/screening/types.js";

/**
 * The patient participant answers from a made-up patient's file and nothing
 * else. Pinned here: it can't see the agent's state, its prompt says "you
 * don't know" for every fact the patient doesn't know, and its replies are
 * read and flagged as the vignette participant's are.
 */

const vocabulary = loadFactVocabulary();

const PATIENT: Patient = {
  id: "p99",
  persona: "made up, short answers",
  search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "female" },
  record: { histology: "adenocarcinoma", prior_pd1: "progressed", egfr: null },
  knows: ["prior_pd1"],
  says: { prior_pd1: "Keytruda, and it grew anyway." },
  dontKnow: { histology: "They said a type, I forget which." },
  dontKnowPhrases: ["No idea.", "I'd have to ask."],
};

describe("simulatePatient", () => {
  it("is blind to the agent: none of its inputs is the session's state or what was carried", () => {
    type Inputs = Parameters<typeof simulatePatient>[number];
    expectTypeOf<
      Extract<Inputs, ScreeningState | Progress | readonly Progress[] | Carried>
    >().toEqualTypeOf<never>();
  });

  it("shows every fact, with the patient's words where they know it and a way of not knowing where they don't", () => {
    const prompt = buildPatientPrompt(PATIENT, vocabulary, [
      { speaker: "agent", text: "Have you had immunotherapy?" },
    ]);
    expect(prompt).toContain("- prior_pd1 (topic: ");
    expect(prompt).toContain('you say "Keytruda, and it grew anyway."');
    expect(prompt).toMatch(
      /- histology \(topic: [^)]*\): you don't know\. Say something like "They said a type, I forget which\."/,
    );
    expect(prompt).not.toMatch(/adenocarcinoma/i);
    expect(prompt).toMatch(/- egfr \(topic: [^)]*\): you don't know/);
    expect(prompt).toContain('1. The tool said: "Have you had immunotherapy?"');
  });

  it("returns the reply and the facts it drew on, keeping ids that aren't facts for the fidelity check", async () => {
    const adapter = new FakeModelAdapter([
      { kind: "json", content: { message: "Yes, Keytruda.", usedFacts: ["prior_pd1", "made_up"] } },
    ]);
    const reply = await simulatePatient(PATIENT, vocabulary, [], freshMemory(), adapter);
    expect(reply.message).toBe("Yes, Keytruda.");
    expect(reply.usedFacts).toEqual(["prior_pd1", "made_up"]);
    expect(reply.memory).toMatchObject({ used: ["prior_pd1", "made_up"], replies: 1 });
  });

  it("retries one unusable reply, then gives up", async () => {
    const ok = new FakeModelAdapter([
      { kind: "json", content: { message: "", usedFacts: [] } },
      { kind: "json", content: { message: "No idea.", usedFacts: [] } },
    ]);
    expect((await simulatePatient(PATIENT, vocabulary, [], freshMemory(), ok)).message).toBe(
      "No idea.",
    );
    const bad = new FakeModelAdapter([
      { kind: "json", content: { usedFacts: [] } },
      { kind: "json", content: { message: "x" }, finishReason: "length" },
    ]);
    await expect(simulatePatient(PATIENT, vocabulary, [], freshMemory(), bad)).rejects.toThrow(
      /p99 gave no usable reply/,
    );
  });
});

describe("patientFlags", () => {
  it("flags a cited id that isn't a fact, and a long uncited assertion, and not an honest don't-know", () => {
    expect(patientFlags(PATIENT, vocabulary, "Yes.", ["prior_pd1"])).toEqual([]);
    expect(patientFlags(PATIENT, vocabulary, "Yes.", ["made_up"])).toEqual([
      { kind: "unknown-fact", facts: ["made_up"] },
    ]);
    const long =
      "I had my gallbladder out in 2015 and my knee replaced, and I take pills for blood pressure.";
    expect(patientFlags(PATIENT, vocabulary, long, [])).toEqual([
      { kind: "uncited-assertion", length: long.length },
    ]);
    expect(
      patientFlags(
        PATIENT,
        vocabulary,
        `I really don't know, ${"they never told me much at all about it. ".repeat(2)}`,
        [],
      ),
    ).toEqual([]);
  });
});
