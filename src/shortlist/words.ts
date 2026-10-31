/**
 * Never a verdict (spec 0004 §7): the words no text this project writes may
 * use, and the scan that finds them. Pure.
 *
 * Every view the page shows keeps its text in one of three fields:
 * - `ours`: text this project writes. Scanned.
 * - `registry`: the trial's own words, verbatim. Not scanned: a trial's title
 *   may say "eligible patients", and it isn't ours to reword.
 * - `said`: the person's own words. Not scanned: someone may type "am I
 *   eligible?".
 */

export type Words = { ours: string } | { registry: string } | { said: string };

export const ours = (text: string): { ours: string } => ({ ours: text });
export const registry = (text: string): { registry: string } => ({ registry: text });
export const said = (text: string): { said: string } => ({ said: text });

/** Case-insensitive. Each says, or comes close to saying, that a person fits or should join. */
export const VERDICT_PATTERNS: readonly RegExp[] = [
  /eligib/i,
  /qualif/i,
  /\byou (fit|match)\b/i,
  /\bfits you\b/i,
  /\bmatches you\b/i,
  /\b(good|great|strong|perfect|close) (fit|match|candidate)\b/i,
  /\byou should\b/i,
  /\byou must\b/i,
  /\bwe recommend\b/i,
  /\brecommended for you\b/i,
  /\bconsider joining\b/i,
  /\bbest (for you|option|match|trial|choice)\b/i,
  /\btop (match|pick|choice)\b/i,
  /\byou can join\b/i,
  /\byou are able to join\b/i,
  /\byou'?d be accepted\b/i,
  /\bright (trial|study) for you\b/i,
];

/** Every `ours` string anywhere in a value, depth first. */
export function oursIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(oursIn);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const own = typeof record["ours"] === "string" ? [record["ours"]] : [];
  return [
    ...own,
    ...Object.entries(record)
      .filter(([key]) => key !== "ours")
      .flatMap(([, v]) => oursIn(v)),
  ];
}

/** The strings that match a verdict pattern. */
export function verdictHits(strings: readonly string[]): string[] {
  return strings.filter((s) => VERDICT_PATTERNS.some((p) => p.test(s)));
}
