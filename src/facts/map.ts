// Imported from the modules directly, not through `src/criteria/index.js`:
// the barrel re-exports `parseCriteria`, which would pull the parser in.
import { locateQuote } from "../criteria/locate.js";
import { NORMALIZE_VERSION, normalize } from "../criteria/normalize.js";
import { type ModelAdapter, monthStamp } from "../models/types.js";
import type { SnapshotTrial } from "../trials/snapshot-types.js";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.js";
import type { FactMapping, FactVocabulary, RejectedMapping, TrialFacts } from "./types.js";
import { FactMappingError } from "./types.js";
import { readMappingEnvelope } from "./validate.js";
import { factsFor } from "./vocabulary.js";

/**
 * Maps one trial's eligibility rules onto the fact vocabulary (spec 0002
 * §3.2). One model call per trial, straight from the text. Only rules that
 * map come back; the rest stay in the trial's text for stage two.
 *
 * The adapter is passed in, as `parseCriteria` takes one: tests supply a
 * fake, and `scripts/facts-map.ts` builds the real one from the factory.
 */

/** Mappings carry short quotes, so far less output than a full parse. Truncation is still a failure. */
const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;

export interface MapOptions {
  cancerType?: string;
  snapshotMonth: string;
  maxOutputTokens?: number;
}

export async function mapTrialFacts(
  trial: SnapshotTrial,
  vocabulary: FactVocabulary,
  adapter: ModelAdapter,
  options: MapOptions,
): Promise<TrialFacts> {
  const cancerType = options.cancerType ?? "nsclc";
  const facts = factsFor(vocabulary, cancerType);
  const normalized = normalize(trial.eligibility.criteriaText);
  const context = `Cannot map facts for ${trial.nctId}`;

  const response = await adapter.complete({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(trial, normalized.text, facts),
    responseFormat: "json",
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  });

  if (response.finishReason === "length") {
    throw new FactMappingError(context, [
      `model output was truncated at ${response.usage.outputTokens} tokens`,
      "raise maxOutputTokens; a cut-off mapping is not a short one",
    ]);
  }

  const { valid, rejected } = readMappingEnvelope(response.content, facts, context);
  const mappings: FactMapping[] = [];
  const allRejected: RejectedMapping[] = [...rejected];
  const seen = new Set<string>();

  for (const entry of valid) {
    // From 0 each time: mappings needn't come in the text's order.
    const found = locateQuote(normalized, entry.quote, 0);
    if (found === undefined) {
      allRejected.push({
        reason: "quote does not appear in the criteria text",
        quote: entry.quote,
        raw: entry,
      });
      continue;
    }
    const key = `${entry.factId}:${found.span.start}-${found.span.end}:${[...entry.rulesOut].sort().join(",")}`;
    if (seen.has(key)) {
      allRejected.push({
        reason: "repeats a mapping already made",
        quote: entry.quote,
        raw: entry,
      });
      continue;
    }
    seen.add(key);
    mappings.push({
      factId: entry.factId,
      rulesOut: entry.rulesOut,
      polarity: entry.polarity,
      source: found.span,
      ...(entry.appliesTo === null ? {} : { appliesTo: entry.appliesTo }),
      ...(found.loose ? { loose: true as const } : {}),
    });
  }

  return {
    nctId: trial.nctId,
    mappings,
    rejected: allRejected,
    run: {
      ...adapter.descriptor,
      promptVersion: PROMPT_VERSION,
      timestamp: monthStamp(),
      vocabularySha256: vocabulary.sha256,
      normalizeVersion: NORMALIZE_VERSION,
      snapshotMonth: options.snapshotMonth,
      cancerType,
    },
  };
}
