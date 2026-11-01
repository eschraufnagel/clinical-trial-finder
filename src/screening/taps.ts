import type { Reading } from "./apply.js";

/**
 * A tapped answer as a reading (slice 0007 of this repository). Every
 * question on the page offers Yes, No and "I don't know", so the check works
 * with no model at all, and a tap needs no confirm: the person chose the
 * words.
 *
 * The tap's own words are both the message and the quote, so the rule that
 * evidence must be in what the person said holds as it is. Its values are
 * readings of the criterion's statement, as every reading is: "Yes" to an
 * exclusion means it holds. `applyReadings` turns a `clinical` criterion's
 * reading into `reported`, pending the chart, as for a typed one.
 */

export type Tap = "yes" | "no" | "unknown";

export const TAP_WORDS: Readonly<Record<Tap, string>> = {
  yes: "Yes",
  no: "No",
  unknown: "I don't know",
};

const TAP_READINGS = {
  yes: "holds",
  no: "does-not-hold",
  unknown: "unknown",
} as const satisfies Record<Tap, Reading["reading"]>;

export function tapReading(criterionId: string, tap: Tap): Reading {
  return { criterionId, reading: TAP_READINGS[tap], quote: TAP_WORDS[tap] };
}
