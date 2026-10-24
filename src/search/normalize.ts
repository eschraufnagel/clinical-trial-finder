/**
 * The text form every vocabulary match is made on (spec 0001 §4): lowercased,
 * every run of characters that isn't a letter or digit replaced by one space,
 * and padded with a space each side. "Non-Small-Cell" and "non small cell"
 * become the same, and a padded term can only match whole words.
 *
 * A leaf module that imports nothing, so the labelling tools may use it
 * without reaching the search (`tests/boundary.test.ts`).
 */
export function normalizeText(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return words === "" ? " " : ` ${words} `;
}

/** Whether `term` occurs as whole words in text already passed through `normalizeText`. */
export function containsTerm(normalized: string, term: string): boolean {
  const needle = normalizeText(term);
  return needle !== " " && normalized.includes(needle);
}
