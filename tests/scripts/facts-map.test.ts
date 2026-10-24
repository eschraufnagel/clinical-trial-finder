import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildManifest,
  remaining,
  runName,
  trialsFor,
  workloadFor,
} from "../../scripts/facts-map.js";
import { planPaidRun, readModelFlags } from "../../scripts/lib/model-flags.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { rules, trial } from "../search/trial-fixture.js";

const vocabulary = loadFactVocabulary();
const lung = { conditions: ["Non-Small Cell Lung Cancer"] };
const TRIALS = [
  trial("NCT00000001", { ...lung, ...rules("ECOG 0-1. No active brain metastases.") }),
  trial("NCT00000002", lung),
  trial("NCT00000003", { conditions: ["Solid Tumor"] }),
];

describe("runName", () => {
  it("names the model, prompt and vocabulary, and nothing else", () => {
    expect(runName("Qwen3.6-35B-A3B-MLX-8bit", "abcdef123456", "0123456789ab")).toBe(
      "qwen3.6-35b-a3b-mlx-8bit-abcdef12-01234567",
    );
  });
});

describe("trialsFor", () => {
  it("takes a labelled set from the labels and the candidates from the search", () => {
    const labels = [
      { nctId: "NCT00000002", set: "dev" as const },
      { nctId: "NCT00000001", set: "heldout" as const },
    ];
    expect(trialsFor("dev", TRIALS, labels).map((t) => t.nctId)).toEqual(["NCT00000002"]);
    expect(trialsFor("candidates", TRIALS, labels).map((t) => t.nctId)).toEqual([
      "NCT00000001",
      "NCT00000002",
      "NCT00000003",
    ]);
  });
});

describe("resuming and the manifest", () => {
  it("skips trials already written and counts the run when it finishes", () => {
    const dir = mkdtempSync(join(tmpdir(), "facts-run-"));
    const write = (id: string, mappings: number) =>
      writeFileSync(
        join(dir, `${id}.json`),
        JSON.stringify({
          mappings: Array(mappings).fill({}),
          rejected: [{}],
          run: { model: "fake" },
        }),
      );
    write("NCT00000001", 2);
    expect(remaining(TRIALS, dir).map((t) => t.nctId)).toEqual(["NCT00000002", "NCT00000003"]);
    write("NCT00000002", 0);
    const manifest = buildManifest(
      dir,
      "fake-x-y",
      ["NCT00000001", "NCT00000002", "NCT00000003"],
      12.4,
    );
    expect(manifest).toMatchObject({
      candidates: 3,
      mapped: 2,
      failed: 1,
      mappings: 2,
      rejectedMappings: 2,
      seconds: 12,
      run: { model: "fake" },
    });
  });
});

describe("a paid run's plan", () => {
  it("is dry without --spend, and builds no adapter", () => {
    const log = join(mkdtempSync(join(tmpdir(), "spend-")), "spend.jsonl");
    const flags = readModelFlags(["--model", "anthropic"], ["model"]);
    const spec = flags.roles["model"];
    if (spec === undefined) throw new Error("no spec");
    const plan = planPaidRun({
      flags,
      paid: [{ role: "mapper", spec, workload: workloadFor(TRIALS, vocabulary) }],
      scope: "3 trials (candidates)",
      spendLog: log,
    });
    expect(plan.kind).toBe("estimate-only");
    expect(workloadFor(TRIALS, vocabulary).expected.calls).toBe(3);
  });
});
