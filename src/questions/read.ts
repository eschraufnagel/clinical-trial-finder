import type { Fact } from "../facts/types.js";
import type { ModelAdapter } from "../models/types.js";
import { buildReaderPrompt, READER_SYSTEM_PROMPT } from "./prompt.js";
import { UNKNOWN } from "./select.js";

/**
 * Reads one reply onto one fact's answers, or onto unknown (spec 0003 §7.1).
 *
 * The model sees the question, its answers and the reply, and nothing else:
 * not the person, not the trials, not other replies. The adapter is passed in,
 * so nothing under `src/questions/` builds one (`tests/boundary.test.ts`).
 *
 * **An unreadable reading never becomes an answer.** An id the fact doesn't
 * have, a truncated reply, or JSON of the wrong shape reads as unknown, with
 * the reason recorded. A failure of the adapter itself (the model unreachable,
 * output that isn't JSON) is thrown, so a run records it and can retry, rather
 * than counting it as the person not knowing.
 */

const DEFAULT_MAX_OUTPUT_TOKENS = 64;

export interface Reading {
  /** An answer id of the fact, or `UNKNOWN`. */
  answer: string;
  /** Why a reading was set to unknown, when the model's output couldn't be used. */
  rejected?: string;
}

export async function readReply(
  fact: Fact,
  reply: string,
  adapter: ModelAdapter,
  options: { maxOutputTokens?: number } = {},
): Promise<Reading> {
  const response = await adapter.complete({
    system: READER_SYSTEM_PROMPT,
    user: buildReaderPrompt(fact, reply),
    responseFormat: "json",
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  });
  if (response.finishReason === "length")
    return { answer: UNKNOWN, rejected: "the model's output was truncated" };

  const record = objectFrom(response.content);
  const answer = record?.["answer"];
  if (typeof answer !== "string")
    return { answer: UNKNOWN, rejected: "the output has no answer string" };
  if (answer === UNKNOWN) return { answer: UNKNOWN };
  if (!fact.answers.some((a) => a.id === answer))
    return { answer: UNKNOWN, rejected: `${answer} isn't an answer to ${fact.id}` };
  return { answer };
}

/**
 * The object a reply holds, unwrapping a one-element array. Copied from
 * `src/screening/calls.ts` rather than imported, so the reader doesn't reach
 * the screening agent.
 */
function objectFrom(content: unknown): Record<string, unknown> | undefined {
  const value = Array.isArray(content) && content.length === 1 ? content[0] : content;
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
