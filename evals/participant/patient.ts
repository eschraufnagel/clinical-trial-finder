import type { FactVocabulary } from "../../src/facts/types.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import type { ModelAdapter } from "../../src/models/index.js";
import { objectFrom } from "../../src/screening/calls.js";
import { type Patient, replyFor } from "../questions/patients.js";
import { type FidelityFlag, NOT_KNOWING, UNCITED_LENGTH } from "./fidelity.js";
import { FIDELITY_SYSTEM_PROMPT, PATIENT_PARTICIPANT_SYSTEM_PROMPT } from "./prompt.js";
import {
  freshMemory,
  type ParticipantMemory,
  type ParticipantReply,
  readReply,
  SimulatorError,
  type TranscriptLine,
} from "./simulate.js";

/**
 * The patient participant (spec 0007 §7.2): the local model answering a
 * check's questions as one made-up patient, from their file and nothing else.
 *
 * Blind to the agent, as the vignette participant is: its inputs are the
 * patient, the vocabulary and the transcript's text, never the session's
 * state or what the conversation carried. The signature enforces that.
 *
 * Its `usedFacts` are fact ids from the vocabulary. They're how the
 * measurement counts a repeat: a question whose reply drew on a fact the
 * conversation already asked. That makes the repeat count a model's report
 * of itself, which `docs/check.md` says.
 */

const MAX_OUTPUT_TOKENS = 300;

export { freshMemory };

/** Every fact for the patient's cancer, with what they say or how they'd say they don't know. */
export function patientFacts(patient: Patient, vocabulary: FactVocabulary): string[] {
  return factsFor(vocabulary, patient.search.cancerType).map((f) => {
    const said = replyFor(patient, f.id, vocabulary);
    return patient.knows.includes(f.id)
      ? `- ${f.id} (topic: ${f.question}): you say "${said}"`
      : `- ${f.id} (topic: ${f.question}): you don't know. Say something like "${said}"`;
  });
}

export function buildPatientPrompt(
  patient: Patient,
  vocabulary: FactVocabulary,
  transcript: readonly TranscriptLine[],
): string {
  const s = patient.search;
  // Quoted and numbered, as the vignette participant's: the local model reads
  // a chat log as something to continue rather than to answer.
  const lines = transcript.map(
    (t, i) =>
      `${i + 1}. ${t.speaker === "agent" ? "The tool" : "You"} said: ${JSON.stringify(t.text)}`,
  );
  return [
    `PERSONA: ${patient.persona}`,
    `You are ${s.age}, ${s.sex}, and your cancer is non-small cell lung cancer.`,
    "",
    "YOUR FACTS:",
    ...patientFacts(patient, vocabulary),
    "",
    "Conversation so far, oldest first:",
    ...lines,
    "",
    'Respond with a JSON object of the form {"message": "...", "usedFacts": [...]} holding your next reply.',
  ].join("\n");
}

export async function simulatePatient(
  patient: Patient,
  vocabulary: FactVocabulary,
  transcript: readonly TranscriptLine[],
  memory: ParticipantMemory,
  adapter: ModelAdapter,
): Promise<ParticipantReply> {
  const request = {
    system: PATIENT_PARTICIPANT_SYSTEM_PROMPT,
    user: buildPatientPrompt(patient, vocabulary, transcript),
    responseFormat: "json" as const,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };

  // One retry on an unusable reply, as the vignette participant does.
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await adapter.complete(request);
    const read = readReply(response.content);
    if (response.finishReason !== "length" && read.reply !== undefined) {
      const used = read.reply.usedFacts;
      return {
        message: read.reply.message,
        // Unknown ids are kept: citing a fact that isn't in the vocabulary is a fidelity flag.
        usedFacts: used,
        instruction: null,
        memory: {
          ...memory,
          used: [...memory.used, ...used.filter((id) => !memory.used.includes(id))],
          replies: memory.replies + 1,
        },
      };
    }
    problems = response.finishReason === "length" ? ["reply was truncated"] : read.problems;
  }
  throw new SimulatorError(`Simulated patient ${patient.id} gave no usable reply`, problems);
}

/**
 * The deterministic checks: a cited fact that isn't one of the cancer's
 * facts, and a long reply that cites nothing and isn't saying "I don't know".
 */
export function patientFlags(
  patient: Patient,
  vocabulary: FactVocabulary,
  message: string,
  usedFacts: readonly string[],
): FidelityFlag[] {
  const flags: FidelityFlag[] = [];
  const known = new Set(factsFor(vocabulary, patient.search.cancerType).map((f) => f.id));
  const unknown = usedFacts.filter((id) => !known.has(id));
  if (unknown.length > 0) flags.push({ kind: "unknown-fact", facts: unknown });
  if (usedFacts.length === 0 && message.length > UNCITED_LENGTH && !NOT_KNOWING.test(message)) {
    flags.push({ kind: "uncited-assertion", length: message.length });
  }
  return flags;
}

/**
 * The local model's read of one reply against the patient's facts, on the
 * vignette check's prompt. A flag for a person to read at Gate 1, never a
 * score; a malformed answer is a flag too.
 */
export async function patientFidelityCheck(
  patient: Patient,
  vocabulary: FactVocabulary,
  message: string,
  adapter: ModelAdapter,
): Promise<FidelityFlag | null> {
  const response = await adapter.complete({
    system: FIDELITY_SYSTEM_PROMPT,
    user: [
      `PERSONA: ${patient.persona}`,
      "",
      "FACTS:",
      ...patientFacts(patient, vocabulary),
      "",
      `MESSAGE: ${JSON.stringify(message)}`,
      "",
      'Respond with a JSON object of the form {"faithful": true | false, "reason": "..."}.',
    ].join("\n"),
    responseFormat: "json",
    maxOutputTokens: 200,
  });
  const record = objectFrom(response.content);
  if (record?.["faithful"] === true) return null;
  if (record?.["faithful"] === false) {
    const reason = record["reason"];
    return { kind: "model", reason: typeof reason === "string" && reason ? reason : "unfaithful" };
  }
  return { kind: "model", reason: "fidelity check returned no usable answer" };
}
