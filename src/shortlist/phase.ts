/**
 * What a trial's phase means, in a sentence (spec 0004 §5.3, research §5:
 * "an honest one-liner on what that phase means"). Written in slice 0004 and
 * reviewed by no clinician; `docs/page.md` says so. Keyed by the registry's
 * phases joined with "+", as `PHASE1+PHASE2`.
 */
export const PHASE_WORDS: Readonly<Record<string, string>> = {
  EARLY_PHASE1:
    "Early Phase 1: a very small first study in people, mostly to learn how a drug behaves in the body.",
  PHASE1:
    "Phase 1: the first tests in people, mostly to find a safe dose and learn the side effects. Whether it works is a later question.",
  "PHASE1+PHASE2":
    "Phase 1/2: first finds a safe dose, then starts to test whether the treatment works.",
  PHASE2:
    "Phase 2: tests whether a treatment works against a cancer, usually in tens to a few hundred people, while still learning its side effects.",
  "PHASE2+PHASE3":
    "Phase 2/3: tests whether a treatment works, then compares it with a standard treatment.",
  PHASE3:
    "Phase 3: compares a treatment with a standard one, in many people. Which treatment each person gets is often decided at random.",
  PHASE4: "Phase 4: studies a treatment that is already approved, to learn more about it.",
  NA: "No phase: the study isn't testing a drug in the usual phases. It may test a device, a procedure or a way of giving care.",
};

/** The sentence for a trial's phases, or the registry's own words for a combination not listed. */
export function phaseWords(phases: readonly string[]): string {
  const key = phases.join("+");
  return (
    PHASE_WORDS[key] ??
    `Phase: ${phases.length === 0 ? "not given" : phases.join(", ")}, as the registry gives it.`
  );
}
