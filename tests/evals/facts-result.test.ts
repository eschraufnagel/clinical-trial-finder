import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { metricsOf } from "../../evals/facts/grade.js";
import { FACT_LABELS_DIR, factLabelsSha256 } from "../../evals/facts/labels.js";
import {
  type FactsEvalResult,
  readFactsResult,
  trustedMetricsOf,
  verifyFactsResult,
} from "../../evals/facts/result.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";

/**
 * Every committed facts result re-derives its numbers from its rows and names
 * the committed labels and vocabulary. The run isn't regraded here, which
 * needs the run's files; `npm run facts:eval -- --check` does that.
 */
const RESULTS = fileURLToPath(new URL("../../evals/results/facts", import.meta.url));
const context = {
  labelsSha256: factLabelsSha256(FACT_LABELS_DIR),
  vocabularySha256: loadFactVocabulary().sha256,
};
const committed = existsSync(RESULTS)
  ? readdirSync(RESULTS)
      .filter((n) => /^\d+-[0-9a-f]+\.json$/.test(n))
      .map((n) => join(RESULTS, n))
  : [];

describe("committed facts results", () => {
  it.each(
    committed.length === 0 ? [["(none yet)"]] : committed.map((f) => [f]),
  )("%s is what it says it is", (file) => {
    if (file === "(none yet)") return;
    expect(verifyFactsResult(readFactsResult(file), { ...context, fileName: file })).toEqual([]);
  });
});

describe("verifyFactsResult", () => {
  const rows: FactsEvalResult["mappingRows"] = [
    {
      nctId: "NCT00000001",
      factId: "ecog",
      rulesOut: ["ps3_4"],
      scoped: false,
      start: 0,
      end: 5,
      grade: "exact",
      displaced: false,
      label: { passage: 1, rulesOut: ["ps3_4"], scoped: false },
    },
  ];
  const labelRows: FactsEvalResult["labelRows"] = [
    {
      nctId: "NCT00000001",
      passage: 1,
      factId: "ecog",
      rulesOut: ["ps3_4"],
      scoped: false,
      found: true,
    },
  ];
  const result: FactsEvalResult = {
    version: 1,
    set: "dev",
    runDir: "data/facts/2000-06/fake-abcdef12-12345678",
    run: {
      model: "fake",
      quantization: "none",
      temperature: 0,
      seed: 0,
      adapter: "fake",
      promptVersion: "abcdef123456",
      timestamp: "2000-06",
      vocabularySha256: context.vocabularySha256,
      normalizeVersion: "2",
      snapshotMonth: "2000-06",
      cancerType: "nsclc",
    },
    labelsSha256: context.labelsSha256,
    trials: ["NCT00000001"],
    missing: [],
    mappingRows: rows,
    labelRows,
    rejected: [],
    metrics: metricsOf(rows, labelRows, [], 1),
  };

  it("passes an honest made-up result", () => {
    expect(verifyFactsResult(result, { ...context, fileName: "01-abcdef123456.json" })).toEqual([]);
  });

  it("checks the trusted facts' numbers when a result has them", () => {
    const withTrusted = {
      ...result,
      trustedFacts: ["ecog"],
      trustedMetrics: trustedMetricsOf(result, new Set(["ecog"])),
    };
    expect(verifyFactsResult(withTrusted, context)).toEqual([]);
    expect(
      verifyFactsResult(
        { ...withTrusted, trustedMetrics: result.metrics, trustedFacts: ["hiv"] },
        context,
      ),
    ).toContain("trusted metrics don't follow from the rows");
  });

  it("would fail a tampered one", () => {
    const tampered = { ...result, metrics: { ...result.metrics, wrong: 0, exact: 7 } };
    expect(verifyFactsResult(tampered, context)).toContain("metrics don't follow from the rows");
    expect(verifyFactsResult({ ...result, labelsSha256: "0" }, context)).toContain(
      "labelsSha256 isn't the committed labels'",
    );
    expect(verifyFactsResult(result, { ...context, fileName: "01-ffffffffffff.json" })).toContain(
      "file name doesn't carry the prompt version",
    );
  });
});
