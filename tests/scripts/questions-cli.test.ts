import { describe, expect, it } from "vitest";
import { armsFor } from "../../evals/questions/arms.js";
import { summarize } from "../../evals/questions/metrics.js";
import type { Patient } from "../../evals/questions/patients.js";
import { formatSummaries } from "../../scripts/questions-eval.js";
import { formatTry } from "../../scripts/questions-try.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import { runConversation } from "../../src/questions/conversation.js";
import { UNKNOWN } from "../../src/questions/select.js";
import { SETTINGS, trials, vocabulary } from "../questions/fixture.js";

/** Words that would tell a person they qualify for, or should join, a trial (spec 0003 §10). */
const VERDICT = /eligib|qualif|you fit|should join/i;

const result = runConversation({
  trials: trials(),
  vocabulary,
  settings: SETTINGS,
  cancerType: "nsclc",
  sex: "male",
  answer: (factId) => (factId === "hiv" ? "uncontrolled" : UNKNOWN),
});
const output = formatTry("p00", result, vocabulary, 8, ["pregnant_or_breastfeeding"]);

describe("formatTry", () => {
  it("prints each question with its answer in the person's words, or that they don't know", () => {
    expect(output).toContain("Has the cancer spread to the brain?  (intake)\n    doesn't know");
    expect(output).toContain("Do you have HIV?  (follow-up, score 1.33)\n    Yes, not controlled");
    expect(output).toContain("moved down: NCT01 NCT03; moved up: NCT04 NCT05");
  });

  it("prints the stop, the short list with hints or their absence, and the open questions", () => {
    expect(output).toContain("Stopped: ");
    expect(output).toContain("NCT02  2 mi  Trial NCT02\n    no hint from these answers");
    expect(output).toContain("Questions for the oncologist");
    expect(output).not.toContain("Are you pregnant or breastfeeding?\n");
  });
});

describe("no verdict", () => {
  it("appears nowhere questions:try prints", () => {
    expect(output).not.toMatch(VERDICT);
  });

  it("appears nowhere questions:eval prints or writes", () => {
    const record: Record<string, string | null> = Object.fromEntries(
      factsFor(vocabulary, "nsclc").map((f) => [f.id, null]),
    );
    const patient: Patient = {
      id: "p00",
      persona: "Made up for a test.",
      search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "female" },
      record,
      knows: [],
      says: {},
      dontKnowPhrases: ["?", "??"],
    };
    const rows = armsFor(patient, "dev", trials(), vocabulary, SETTINGS, { fromStart: true });
    const summaries = summarize(rows);
    expect(formatSummaries("dev", summaries)).not.toMatch(VERDICT);
    expect(JSON.stringify({ rows, summaries })).not.toMatch(VERDICT);
  });
});
