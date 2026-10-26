import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TrialFacts } from "../../src/facts/types.js";
import { factsFor, loadFactVocabulary } from "../../src/facts/vocabulary.js";

/**
 * Committed candidate runs (0002 step 14): 20 mapping files per run, chosen
 * by hash, agree with the run's manifest and the vocabulary. Quotes against
 * the snapshot text aren't checked here, which would load the whole snapshot;
 * `work/0002-fact-vocabulary/plan.md` records that check, made once by script.
 */
const ROOT = fileURLToPath(new URL("../../data/facts", import.meta.url));
const vocabulary = loadFactVocabulary();
const facts = new Map(factsFor(vocabulary, "nsclc").map((f) => [f.id, f]));

const runs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((month) =>
    readdirSync(join(ROOT, month.name), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, month.name, d.name, "manifest.json")))
      .map((d) => join(ROOT, month.name, d.name)),
  );

describe.each(
  runs.length === 0 ? [["(none)"]] : runs.map((r) => [r]),
)("candidate run %s", (dir) => {
  it("agrees with its manifest and the vocabulary on a sample of 20", () => {
    if (dir === "(none)") return;
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      mapped: number;
      run: TrialFacts["run"];
    };
    const files = readdirSync(dir).filter((n) => /^NCT\d{8}\.json$/.test(n));
    expect(files.length).toBe(manifest.mapped);
    const order = (n: string) => createHash("sha256").update(`sample:${n}`).digest("hex");
    const sample = [...files].sort((a, b) => (order(a) < order(b) ? -1 : 1)).slice(0, 20);
    for (const name of sample) {
      const t = JSON.parse(readFileSync(join(dir, name), "utf8")) as TrialFacts;
      expect(t.nctId).toBe(name.slice(0, -5));
      for (const key of ["model", "promptVersion", "vocabularySha256", "seed"] as const) {
        expect(t.run[key], `${name} ${key}`).toBe(manifest.run[key]);
      }
      expect(t.run.vocabularySha256).toBe(vocabulary.sha256);
      for (const m of t.mappings) {
        const fact = facts.get(m.factId);
        expect(fact, `${name} ${m.factId}`).toBeDefined();
        const answers = new Set(fact?.answers.map((a) => a.id));
        expect(
          m.rulesOut.every((a) => answers.has(a)),
          `${name} ${m.factId}`,
        ).toBe(true);
        expect(m.source.end).toBeGreaterThan(m.source.start);
        expect(m.source.text.length).toBe(m.source.end - m.source.start);
      }
    }
  });
});
