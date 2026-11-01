import type { ModelAdapter } from "../../src/models/index.js";
import { objectFrom } from "../../src/screening/calls.js";
import { type FidelityFlag, NOT_KNOWING, UNCITED_LENGTH } from "./fidelity.js";
import { SUMMARY_FIDELITY_SYSTEM_PROMPT, SUMMARY_PARTICIPANT_SYSTEM_PROMPT } from "./prompt.js";
import { SimulatorError, type TranscriptLine } from "./simulate.js";

/**
 * The summary participant (spec 0008 §7.4): the local model answering the
 * deeper check's questions as the person one text describes, an NIH-TrialBench
 * summary or a patient's account of it.
 *
 * Blind to the agent, as 0007's participants are: its inputs are the text and
 * the transcript's lines, never the session's state, the trial's label or which
 * arm it's playing. The signature enforces that, and a type test pins it.
 *
 * Fidelity is checked two ways. Deterministically, every quote it gives must be
 * in the text (compared with case and runs of spaces ignored, since a model
 * copying a phrase reflows it), and a long reply quoting nothing that isn't
 * "I don't know" is flagged. And by the local model's read of the reply against
 * the text, a flag for a person to read, never a score.
 */

const MAX_OUTPUT_TOKENS = 300;

export interface SummaryReply {
  message: string;
  quotes: string[];
}

export function buildSummaryPrompt(text: string, transcript: readonly TranscriptLine[]): string {
  // Quoted and numbered, as 0007's participant: the local model reads a chat
  // log as something to continue rather than to answer.
  const lines = transcript.map(
    (t, i) =>
      `${i + 1}. ${t.speaker === "agent" ? "The tool" : "You"} said: ${JSON.stringify(t.text)}`,
  );
  return [
    "YOUR TEXT:",
    text.trim(),
    "",
    "Conversation so far, oldest first:",
    ...lines,
    "",
    'Respond with a JSON object of the form {"message": "...", "quotes": [...]} holding your next reply.',
  ].join("\n");
}

export function readSummaryReply(content: unknown): { reply?: SummaryReply; problems: string[] } {
  const record = objectFrom(content);
  if (record === undefined) return { problems: ["reply is not a JSON object"] };
  const message = record["message"];
  const quotes = record["quotes"];
  const problems: string[] = [];
  if (typeof message !== "string" || message.trim().length === 0) {
    problems.push("message is missing or empty");
  }
  if (!Array.isArray(quotes) || !quotes.every((q) => typeof q === "string")) {
    problems.push("quotes is not an array of strings");
  }
  if (problems.length > 0) return { problems };
  return { reply: { message: (message as string).trim(), quotes: quotes as string[] }, problems };
}

export async function simulateFromSummary(
  text: string,
  transcript: readonly TranscriptLine[],
  adapter: ModelAdapter,
): Promise<SummaryReply> {
  const request = {
    system: SUMMARY_PARTICIPANT_SYSTEM_PROMPT,
    user: buildSummaryPrompt(text, transcript),
    responseFormat: "json" as const,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  // One retry on an unusable reply, as 0007's participant does.
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await adapter.complete(request);
    const read = readSummaryReply(response.content);
    if (response.finishReason !== "length" && read.reply !== undefined) return read.reply;
    problems = response.finishReason === "length" ? ["reply was truncated"] : read.problems;
  }
  throw new SimulatorError("The summary participant gave no usable reply", problems);
}

const loose = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The deterministic checks. A quote that isn't in the text is reported as
 * `unknown-fact`, the kind 0007's participants use for citing what their file
 * doesn't hold.
 */
export function summaryFlags(text: string, reply: SummaryReply): FidelityFlag[] {
  const flags: FidelityFlag[] = [];
  const haystack = loose(text);
  const missing = reply.quotes.filter((q) => q.trim() === "" || !haystack.includes(loose(q)));
  if (missing.length > 0) flags.push({ kind: "unknown-fact", facts: missing });
  if (
    reply.quotes.length === 0 &&
    reply.message.length > UNCITED_LENGTH &&
    !NOT_KNOWING.test(reply.message)
  ) {
    flags.push({ kind: "uncited-assertion", length: reply.message.length });
  }
  return flags;
}

export async function summaryFidelityCheck(
  text: string,
  message: string,
  adapter: ModelAdapter,
): Promise<FidelityFlag | null> {
  const response = await adapter.complete({
    system: SUMMARY_FIDELITY_SYSTEM_PROMPT,
    user: [
      "TEXT:",
      text.trim(),
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
