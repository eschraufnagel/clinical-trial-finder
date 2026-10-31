import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Patient } from "../../evals/questions/patients.js";
import type { ReadsFile } from "../../evals/questions/reads.js";
import { failureText, formatUnusable, readAll, readsPath } from "../../scripts/questions-read.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import { FakeModelAdapter } from "../../src/models/fake.js";
import { ModelError } from "../../src/models/types.js";
import { vocabulary } from "../questions/fixture.js";

const FACTS = factsFor(vocabulary, "nsclc");
const record: Record<string, string | null> = Object.fromEntries(FACTS.map((f) => [f.id, null]));
const patient: Patient = {
  id: "p00",
  persona: "Made up for a test.",
  search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "female" },
  record,
  knows: [],
  says: {},
  dontKnowPhrases: ["?", "??"],
};

describe("readAll", () => {
  it("writes as it goes, records failures, and resumes with only what's left", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "reads-")), "dev-fake.json");
    // First run: two readings, then the adapter fails once, then runs dry and fails the rest.
    const first = new FakeModelAdapter([
      { kind: "json", content: { answer: "unknown" } },
      { kind: "json", content: { answer: "unknown" } },
      { kind: "raw", raw: "not json" },
    ]);
    const input = {
      set: "dev" as const,
      patients: [patient],
      vocabulary,
      path,
      patientsSha256: "a",
    };
    await readAll({ ...input, adapter: first });
    const afterFirst = JSON.parse(readFileSync(path, "utf8")) as ReadsFile;
    expect(afterFirst.items).toHaveLength(2);
    expect(Object.keys(afterFirst.failures)).toHaveLength(FACTS.length - 2);

    const second = new FakeModelAdapter([], {
      respond: () => ({ kind: "json", content: { answer: "unknown" } }),
    });
    const { file } = await readAll({ ...input, adapter: second });
    expect(second.requests).toHaveLength(FACTS.length - 2);
    expect(file.items).toHaveLength(FACTS.length);
    expect(file.failures).toEqual({});
  });

  // Found in 0004's hosted run: a failure recorded only the error's first
  // line, "Anthropic request to … failed:", and not why.
  it("records why a reading failed, not only that it did", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "reads-")), "dev-fake.json");
    const adapter = new FakeModelAdapter([{ kind: "error", message: "HTTP 429: rate limited" }]);
    await readAll({
      set: "dev",
      patients: [patient],
      vocabulary,
      path,
      patientsSha256: "a",
      adapter,
    });
    const file = JSON.parse(readFileSync(path, "utf8")) as ReadsFile;
    expect(Object.values(file.failures)[0]).toContain("HTTP 429: rate limited");
  });

  it("refuses a file read from other patients", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "reads-")), "dev-fake.json");
    const adapter = new FakeModelAdapter([], {
      respond: () => ({ kind: "json", content: { answer: "unknown" } }),
    });
    const input = { set: "dev" as const, patients: [patient], vocabulary, path, adapter };
    await readAll({ ...input, patientsSha256: "a" });
    await expect(readAll({ ...input, patientsSha256: "b" })).rejects.toThrow(/other patients/);
  });
});

describe("failureText", () => {
  it("keeps the reasons on one line, and never a text that holds the key", () => {
    const error = new ModelError("Anthropic request failed", ["HTTP 429", "rate\nlimited"]);
    expect(failureText(error)).toBe("Anthropic request failed: HTTP 429 rate limited");
    expect(failureText(error, (t) => t.includes("429"))).toMatch(/held the key/);
  });
});

describe("readsPath", () => {
  it("names the set, the model and the prompt", () => {
    expect(readsPath("dev", { model: "Qwen3.6-35B-A3B-MLX-8bit" }, "/x")).toMatch(
      /^\/x\/dev-qwen3\.6-35b-a3b-mlx-8bit-[0-9a-f]{8}\.json$/,
    );
  });

  // Slice 0006: a run that enforced the schema never resumes or overwrites
  // 0004's run of the same model and prompt, made without it.
  it("names a run whose schema was enforced apart from one without", () => {
    const plain = readsPath("heldout", { model: "claude-haiku-4-5" }, "/x");
    const shaped = readsPath("heldout", { model: "claude-haiku-4-5", schema: "enforced" }, "/x");
    expect(plain).toBe("/x/heldout-claude-haiku-4-5-8cb01749.json");
    expect(shaped).toBe("/x/heldout-claude-haiku-4-5-8cb01749-schema.json");
  });
});

describe("formatUnusable", () => {
  it("counts rejections by reason and lists each failure with its reason", () => {
    const item = { patient: "p00", kind: "phrase" as const, reply: "?", expected: "unknown" };
    const text = formatUnusable({
      items: [
        { ...item, factId: "a", answer: "unknown", rejected: "the model's output was truncated" },
        { ...item, factId: "b", answer: "unknown", rejected: "the model's output was truncated" },
        { ...item, factId: "c", answer: "unknown" },
      ],
      failures: { "p00:d": "model output is not JSON" },
    } as unknown as ReadsFile);
    expect(text).toBe(
      [
        "Rejected, by reason:",
        "     2  the model's output was truncated",
        "Failed:",
        `  ${"p00:d".padEnd(34)} model output is not JSON`,
      ].join("\n"),
    );
  });
});
