import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFor, loadFactVocabulary } from "../../src/facts/vocabulary.js";

function vocabularyFile(value: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "facts-")), "vocabulary.json");
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
  return path;
}

const FACT = {
  id: "brain_mets",
  question: "Has the cancer spread to the brain?",
  answers: [
    { id: "none", words: "No" },
    { id: "active", words: "Yes" },
  ],
  whoKnows: "patient",
  cancerTypes: "all",
};

function problems(value: unknown): string {
  try {
    loadFactVocabulary(vocabularyFile(value));
  } catch (e) {
    return (e as Error).message;
  }
  return "";
}

describe("loadFactVocabulary", () => {
  it("loads the committed vocabulary, every fact applying to NSCLC", () => {
    const vocabulary = loadFactVocabulary();
    expect(vocabulary.facts.length).toBeGreaterThanOrEqual(25);
    expect(vocabulary.facts.length).toBeLessThanOrEqual(40);
    expect(factsFor(vocabulary, "nsclc")).toHaveLength(vocabulary.facts.length);
    expect(vocabulary.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps NSCLC-only facts out of other cancer types", () => {
    const vocabulary = loadFactVocabulary(
      vocabularyFile({
        version: 1,
        facts: [FACT, { ...FACT, id: "egfr", cancerTypes: ["nsclc"] }],
      }),
    );
    expect(factsFor(vocabulary, "breast").map((f) => f.id)).toEqual(["brain_mets"]);
  });

  it("reports every problem at once", () => {
    const message = problems({
      version: 2,
      facts: [
        FACT,
        { ...FACT, question: "" },
        {
          ...FACT,
          id: "Bad-Id",
          whoKnows: "nurse",
          cancerTypes: [],
          answers: [{ id: "unknown", words: "Not sure" }, { id: "yes" }],
        },
        { ...FACT, id: "one_answer", answers: [{ id: "yes", words: "Yes" }] },
        {
          ...FACT,
          id: "repeats",
          answers: [
            { id: "yes", words: "Yes" },
            { id: "yes", words: "Yes" },
          ],
        },
      ],
    });
    expect(message).toMatch(/version is not 1/);
    expect(message).toMatch(/brain_mets: id is repeated/);
    expect(message).toMatch(/question is missing/);
    expect(message).toMatch(/Bad-Id: id is not snake_case/);
    expect(message).toMatch(/whoKnows is not/);
    expect(message).toMatch(/cancerTypes is not/);
    expect(message).toMatch(/"unknown" is listed as an answer/);
    expect(message).toMatch(/answer 2 has no words/);
    expect(message).toMatch(/one_answer: answers is not a list of 2 to 6/);
    expect(message).toMatch(/repeats: answer yes is repeated/);
  });

  it("refuses a file that isn't JSON", () => {
    expect(problems("{")).toMatch(/not JSON/);
  });
});
