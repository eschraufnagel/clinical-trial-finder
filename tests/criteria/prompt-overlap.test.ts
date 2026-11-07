import { describe, expect, it } from "vitest";
import { loadTrialBench } from "../../evals/benchmark/trialbench.js";
import { SYSTEM_PROMPT } from "../../src/criteria/prompt.js";
import { loadTrials } from "../../src/trials/load.js";

/**
 * The parser's examples come from outside the trials it's measured on
 * (`src/criteria/prompt.ts`, header). The prescreening repository checked that
 * with `eval:compare -- --overlap`, which didn't come over; this does it here,
 * as `tests/screening/prompts.test.ts` does for the agent's reading prompt.
 */
describe("the parser's prompt", () => {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 0);
  const prompt = ` ${words(SYSTEM_PROMPT).join(" ")} `;
  const shared = (texts: readonly string[]) => {
    const found = new Set<string>();
    for (const t of texts) {
      const w = words(t);
      for (let i = 0; i + 5 <= w.length; i++) {
        const run = w.slice(i, i + 5).join(" ");
        if (prompt.includes(` ${run} `)) found.add(run);
      }
    }
    return [...found];
  };

  // The consent boundary case, in the prompt before this slice, shares these
  // with NIH-TrialBench's trials. Nothing added since may share another.
  const BEFORE_0010 = ["to understand and sign informed", "understand and sign informed consent"];

  it("shares no new run of five words with any NIH-TrialBench trial's criteria", () => {
    const { trials } = loadTrialBench();
    expect(trials.length).toBeGreaterThan(100);
    expect(
      shared(trials.map((t) => t.criteriaText)).filter((r) => !BEFORE_0010.includes(r)),
    ).toEqual([]);
  });

  it("shares no run of five words with the twelve pinned protocols", () => {
    const trials = loadTrials();
    expect(trials).toHaveLength(12);
    expect(shared(trials.map((t) => t.eligibility.criteriaText))).toEqual([]);
  });
});
