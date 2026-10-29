import type { Words } from "../shortlist/words.js";

/**
 * One piece of text from a view, kept as what it is: the trial's own words
 * are marked `data-registry`, the person's `data-said`, so the browser
 * test's verdict scan reads only the project's own (spec 0004 §7).
 */
export function W({ w }: { w: Words }) {
  if ("registry" in w) return <span data-registry="">{w.registry}</span>;
  if ("said" in w) return <q data-said="">{w.said}</q>;
  return <>{w.ours}</>;
}

/** The text itself, whatever its kind: for a React key. */
export function textOf(w: Words): string {
  return "ours" in w ? w.ours : "registry" in w ? w.registry : w.said;
}
