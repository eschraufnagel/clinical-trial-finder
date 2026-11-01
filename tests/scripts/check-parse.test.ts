import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseWorkload } from "../../scripts/check-parse.js";
import { criteriaRunName, latestCriteriaRun } from "../../src/check/parse-cache.js";
import { getTrial } from "../../src/trials/index.js";

/** The measurement's parse runs: where they go, how one is found, what one would cost. */

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("criteriaRunName", () => {
  it("names the model, the parser's prompt and its normalize version", () => {
    expect(criteriaRunName("Qwen3.6-35B-A3B-MLX-8bit", "73c3b301c4a9abcd", "2")).toBe(
      "qwen3.6-35b-a3b-mlx-8bit-73c3b301-n2",
    );
  });
});

describe("latestCriteriaRun", () => {
  it("is the directory named in <month>/latest, or nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "criteria-"));
    dirs.push(root);
    expect(latestCriteriaRun("2000-06", root)).toBeUndefined();
    mkdirSync(join(root, "2000-06"));
    writeFileSync(join(root, "2000-06", "latest"), "some-run\n");
    expect(latestCriteriaRun("2000-06", root)).toBe(join(root, "2000-06", "some-run"));
  });
});

describe("parseWorkload", () => {
  it("counts one call a trial, its prompt's tokens, and the parser's ceiling", () => {
    const trial = getTrial("NCT04316364");
    const w = parseWorkload([trial, trial]);
    expect(w.expected.calls).toBe(2);
    expect(w.expected.inputTokens).toBeGreaterThan(2 * (trial.eligibility.criteriaText.length / 6));
    expect(w.perCallCeiling.outputTokens).toBe(16_384);
  });
});
