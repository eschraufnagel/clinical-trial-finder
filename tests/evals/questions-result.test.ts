import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { armsFor } from "../../evals/questions/arms.js";
import type { Patient, PatientSet } from "../../evals/questions/patients.js";
import {
  patientsSha256,
  type QuestionsEvalResult,
  readResult,
  summariesFor,
  verifyResult,
} from "../../evals/questions/result.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import { loadConversationSettings } from "../../src/questions/settings.js";
import { SETTINGS, trials, vocabulary } from "../questions/fixture.js";

/**
 * Every committed question-selection result is re-derived from its rows and
 * checked against the committed patients and settings. The conversations
 * aren't rerun here, because that needs the snapshot; `npm run
 * questions:eval -- --check` does that.
 */
const RESULTS = fileURLToPath(new URL("../../evals/results/questions", import.meta.url));
const context = {
  patientsSha256: { dev: patientsSha256("dev"), heldout: patientsSha256("heldout") },
  settingsSha256: loadConversationSettings(vocabulary).sha256,
};

function resultFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => /^\d+-[0-9a-f]+\.json$/.test(n))
      .map((n) => join(dir, n));
  } catch {
    return [];
  }
}

describe("committed results", () => {
  const files = [...resultFiles(RESULTS), ...resultFiles(join(RESULTS, "dev"))];

  it("are numbered result files, each checked below", () => {
    expect(files.every((f) => /\/\d+-[0-9a-f]{12}\.json$/.test(f))).toBe(true);
  });
  for (const file of files) {
    it(`${basename(file)} follows from its rows and names the committed patients`, () => {
      const result = readResult(file);
      expect(
        verifyResult(result, { patientsSha256: context.patientsSha256, fileName: file }),
      ).toEqual([]);
    });
  }

  // Dev results come before Gate 2 freezes the settings, so only the latest
  // held-out result must carry the committed ones.
  const heldout = resultFiles(RESULTS).sort().at(-1);
  if (heldout !== undefined) {
    it(`${basename(heldout)}, the latest held-out result, used the committed settings`, () => {
      expect(readResult(heldout).settingsSha256).toBe(context.settingsSha256);
    });
  }
});

describe("verifyResult", () => {
  const record: Record<string, string | null> = Object.fromEntries(
    factsFor(vocabulary, "nsclc").map((f) => [f.id, null]),
  );
  record["hiv"] = "uncontrolled";
  const patient: Patient = {
    id: "pa",
    persona: "Made up for a test.",
    search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "female" },
    record,
    knows: [],
    says: {},
    dontKnowPhrases: ["?", "??"],
  };
  const sets: PatientSet[] = ["dev"];
  const rows = armsFor(patient, "dev", trials(), vocabulary, SETTINGS);
  const { sha256, ...settings } = SETTINGS;
  const good: QuestionsEvalResult = {
    version: 1,
    sets,
    patientsSha256: { dev: "a" },
    settings,
    settingsSha256: sha256,
    run: { name: "fake", promptVersion: "0", vocabularySha256: vocabulary.sha256 },
    snapshot: { month: "2000-01", sha256: "0" },
    reads: null,
    rows,
    summaries: summariesFor(rows, sets),
  };
  const ctx = { patientsSha256: { dev: "a" }, settingsSha256: sha256 };

  it("passes a result that follows from its rows", () => {
    expect(verifyResult(good, { ...ctx, fileName: `01-${sha256.slice(0, 12)}.json` })).toEqual([]);
  });

  it("catches a changed number, a changed summary, and checksums that don't match", () => {
    const [first, ...rest] = rows;
    if (first === undefined) throw new Error("no rows");
    const intake = rest.findIndex((r) => r.arm === "intake");
    const changed = rest.map((r, i) => (i === intake ? { ...r, agreement: 1 } : r));
    expect(verifyResult({ ...good, rows: [first, ...changed] }, ctx).join(" ")).toMatch(
      /intake : agreement doesn't follow/,
    );
    const summaries = { dev: (good.summaries.dev ?? []).map((s) => ({ ...s, followUps: 99 })) };
    expect(verifyResult({ ...good, summaries }, ctx)).toContain(
      "summaries don't follow from the rows",
    );
    expect(verifyResult(good, { ...ctx, patientsSha256: { dev: "b" } })).toContain(
      "the dev patients' checksum isn't the committed patients'",
    );
    expect(verifyResult(good, { ...ctx, settingsSha256: "other" })).toContain(
      "settingsSha256 isn't the committed settings'",
    );
    expect(verifyResult(good, { ...ctx, fileName: "01-ffffffffffff.json" })).toContain(
      "file name doesn't carry the settings' checksum",
    );
  });
});
