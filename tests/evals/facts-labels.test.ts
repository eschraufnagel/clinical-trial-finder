import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  criteriaTextSha,
  type FactLabels,
  isComplete,
  loadFactLabels,
} from "../../evals/facts/labels.js";
import { drawSample, skeleton } from "../../scripts/facts-sample.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { rules, trial } from "../search/trial-fixture.js";

const vocabulary = loadFactVocabulary();
const TEXT = "Inclusion Criteria:\n\n* ECOG 0-1\n* No active brain metastases.\n* ANC >= 1500/uL";
const TRIAL = trial("NCT00000001", rules(TEXT));
const TEXTS = new Map([["NCT00000001", TEXT]]);

function dirWith(labels: FactLabels): string {
  const dir = mkdtempSync(join(tmpdir(), "fact-labels-"));
  writeFileSync(join(dir, `${labels.nctId}.json`), JSON.stringify(labels));
  return dir;
}

function problems(labels: FactLabels): string {
  try {
    loadFactLabels(dirWith(labels), vocabulary, TEXTS);
  } catch (e) {
    return (e as Error).message;
  }
  return "";
}

describe("skeleton", () => {
  it("splits the text into unlabelled passages at the text's own offsets", () => {
    const labels = skeleton(TRIAL, "dev", vocabulary.sha256);
    expect(labels.passages.map((p) => p.quote)).toEqual([
      "ECOG 0-1",
      "No active brain metastases.",
      "ANC >= 1500/uL",
    ]);
    expect(labels.criteriaTextSha).toBe(criteriaTextSha(TEXT));
    expect(isComplete(labels)).toBe(false);
    expect(loadFactLabels(dirWith(labels), vocabulary, TEXTS)).toHaveLength(1);
  });
});

describe("drawSample", () => {
  it("takes 10 dev and 30 held-out by hash, the same whatever the input order", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `NCT${String(i).padStart(8, "0")}`);
    const a = drawSample(ids);
    const b = drawSample([...ids].reverse());
    expect(a).toEqual(b);
    expect(a.dev).toHaveLength(10);
    expect(a.heldout).toHaveLength(30);
    expect(new Set([...a.dev, ...a.heldout]).size).toBe(40);
  });
});

describe("loadFactLabels", () => {
  const base = skeleton(TRIAL, "heldout", vocabulary.sha256);
  const [ecog, brain, anc] = base.passages as [
    FactLabels["passages"][number],
    FactLabels["passages"][number],
    FactLabels["passages"][number],
  ];

  it("accepts a complete, valid label set", () => {
    const labels: FactLabels = {
      ...base,
      passages: [
        { ...ecog, mappings: [{ factId: "ecog", rulesOut: ["ps2", "ps3_4"], appliesTo: null }] },
        { ...brain, mappings: [{ factId: "brain_mets", rulesOut: ["symptoms"], appliesTo: null }] },
        { ...anc, unmapped: "organ-function" },
      ],
    };
    expect(problems(labels)).toBe("");
    expect(isComplete(labels)).toBe(true);
  });

  it("names every problem at once", () => {
    const message = problems({
      ...base,
      set: "train" as FactLabels["set"],
      vocabularySha256: "0".repeat(64),
      passages: [
        {
          ...ecog,
          quote: "ECOG 0-2",
          unmapped: "procedure",
          mappings: [{ factId: "ecog", rulesOut: ["ps0", "ps1", "ps2", "ps3_4"], appliesTo: "" }],
        },
        {
          ...brain,
          mappings: [
            { factId: "brain_mets", rulesOut: [], appliesTo: null },
            { factId: "mood", rulesOut: ["sad"], appliesTo: null },
            { factId: "egfr", rulesOut: ["positive", "none_found", "none_found"], appliesTo: null },
          ],
        },
        { ...anc, unmapped: "vocabulary-gap" },
      ],
    });
    expect(message).toMatch(/set is not dev or heldout/);
    expect(message).toMatch(/written against a different vocabulary/);
    expect(message).toMatch(/passage 1: quote isn't the text/);
    expect(message).toMatch(/passage 1: has both mappings and an unmapped category/);
    expect(message).toMatch(/passage 1: ecog rules out every answer/);
    expect(message).toMatch(/passage 1: appliesTo is empty/);
    expect(message).toMatch(/passage 2: brain_mets rules out nothing/);
    expect(message).toMatch(/passage 2: mood isn't a fact for nsclc/);
    expect(message).toMatch(/passage 2: egfr has no answer positive/);
    expect(message).toMatch(/passage 2: egfr repeats an answer/);
    expect(message).toMatch(/passage 3: a vocabulary gap needs a note/);
  });

  it("refuses labels drawn from different text", () => {
    expect(problems({ ...base, criteriaTextSha: criteriaTextSha("other") })).toMatch(
      /eligibility text has changed/,
    );
  });
});
