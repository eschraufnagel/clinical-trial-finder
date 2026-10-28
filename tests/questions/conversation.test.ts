import { describe, expect, it } from "vitest";
import { openQuestions, runConversation } from "../../src/questions/conversation.js";
import { UNKNOWN } from "../../src/questions/select.js";
import { SETTINGS, trials, vocabulary } from "./fixture.js";

const knows =
  (answers: Record<string, string>) =>
  (factId: string): string =>
    answers[factId] ?? UNKNOWN;

function run(
  answers: Record<string, string>,
  extra: Partial<Parameters<typeof runConversation>[0]> = {},
) {
  return runConversation({
    trials: trials(),
    vocabulary,
    settings: SETTINGS,
    cancerType: "nsclc",
    sex: "female",
    answer: knows(answers),
    ...extra,
  });
}

describe("runConversation", () => {
  it("asks the intake first, in order, then follows the scorer", () => {
    // After hiv moves NCT01 and NCT03 down, NCT02, NCT04 and NCT05 all map
    // pregnancy, so it's asked; then ECOG touches no short-list trial: stable.
    const r = run({ hiv: "uncontrolled" });
    expect(r.steps[0]).toMatchObject({ factId: "brain_mets", phase: "intake", score: null });
    expect(r.steps.slice(1).map((s) => s.factId)).toEqual(["hiv", "pregnant_or_breastfeeding"]);
    expect(r.stop).toBe("stable");
    expect(r.steps[1]?.phase).toBe("follow-up");
  });

  it("records the short list before and after, and what entered and left", () => {
    const step = run({ hiv: "uncontrolled" }).steps[1];
    expect(step?.before).toEqual(["NCT01", "NCT02", "NCT03"]);
    expect(step?.after).toEqual(["NCT02", "NCT04", "NCT05"]);
    expect(step?.left).toEqual(["NCT01", "NCT03"]);
    expect(step?.entered).toEqual(["NCT04", "NCT05"]);
  });

  it("keeps every trial in the order, hinted ones lower", () => {
    const r = run({ hiv: "uncontrolled" });
    expect(r.order).toHaveLength(8);
    expect(r.order.slice(-2).map((e) => e.candidate.nctId)).toEqual(["NCT01", "NCT03"]);
  });

  it("asks an unknown fact once, and moves nothing for it", () => {
    const r = run({}, { scorer: "fixed" });
    const asked = r.steps.map((s) => s.factId);
    expect(new Set(asked).size).toBe(asked.length);
    for (const step of r.steps) {
      expect(step.reply).toBe(UNKNOWN);
      expect(step.after).toEqual(step.before);
    }
    expect(r.profile).toEqual({});
    expect(r.stop).toBe("nothing-left");
  });

  it("stops at the budget", () => {
    const r = run({}, { scorer: "count", budget: 1 });
    expect(r.steps.filter((s) => s.phase === "follow-up")).toHaveLength(1);
    expect(r.stop).toBe("budget");
  });

  it("stops `shortlist` when nothing could move the short list", () => {
    // A short list of all eight: no answer can push a trial out of it.
    const r = run({}, { settings: { ...SETTINGS, shortlistSize: 8 } });
    expect(r.steps.map((s) => s.phase)).toEqual(["intake"]);
    expect(r.stop).toBe("stable");
  });

  it("never asks a man the skipped fact", () => {
    const r = run({}, { sex: "male", scorer: "fixed" });
    expect(r.steps.map((s) => s.factId)).not.toContain("pregnant_or_breastfeeding");
  });

  it("from the start: no intake, and the intake's length added to the budget", () => {
    // The intake's one fact, brain_mets, is mapped by no trial, so the chooser never picks it.
    const r = run({}, { intake: false, scorer: "fixed", budget: 1 });
    expect(r.steps.every((s) => s.phase === "follow-up")).toBe(true);
    expect(r.steps.map((s) => s.factId)).toEqual(["ecog", "hiv"]);
    expect(r.stop).toBe("budget");
  });

  it("refuses an answer the fact doesn't have", () => {
    expect(() => run({ brain_mets: "maybe" })).toThrow(/brain_mets has no answer maybe/);
  });
});

describe("openQuestions", () => {
  it("counts the short list's unanswered facts, most first, then in vocabulary order", () => {
    const r = run({}, { scorer: "fixed", budget: 0 });
    expect(openQuestions(r.shortlist, r.profile, vocabulary)).toEqual([
      { factId: "hiv", trials: 2 },
      { factId: "ecog", trials: 1 },
      { factId: "pregnant_or_breastfeeding", trials: 1 },
    ]);
  });

  it("leaves out answered facts, including ones with hints", () => {
    const r = run({ ecog: "ps2" }, { scorer: "fixed", budget: 1 });
    const open = openQuestions(r.order, r.profile, vocabulary).map((o) => o.factId);
    expect(open).not.toContain("ecog");
  });
});
