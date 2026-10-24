import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  labelsSha256,
  NSCLC_LABELS,
  readSearchLabels,
  type SearchLabels,
} from "../../evals/search/labels.js";
import { metricsFor } from "../../evals/search/metrics.js";
import { readResult, type SearchEvalResult, verifyResult } from "../../evals/search/result.js";
import { loadVocabulary } from "../../src/search/vocabulary.js";
import { DEFAULT_SNAPSHOT_DIR } from "../../src/trials/snapshot-load.js";

/**
 * Every committed search result is re-derived from its rows and checked
 * against the committed labels, label checksum and snapshot manifest. The
 * search itself isn't rerun here, because that needs the full snapshot;
 * `npm run search:eval -- --check` does that.
 */
const RESULTS = fileURLToPath(new URL("../../evals/results/search", import.meta.url));
const manifest = JSON.parse(readFileSync(join(DEFAULT_SNAPSHOT_DIR, "manifest.json"), "utf8")) as {
  sha256: string;
};
const labels = readSearchLabels(NSCLC_LABELS);
const context = {
  labels,
  labelsSha256: labelsSha256(NSCLC_LABELS),
  snapshotSha256: manifest.sha256,
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

const committed = [...resultFiles(RESULTS), ...resultFiles(join(RESULTS, "dev"))];

describe("committed search results", () => {
  it.each(
    committed.length === 0 ? [["(none yet)"]] : committed.map((f) => [f]),
  )("%s is what it says it is", (file) => {
    if (file === "(none yet)") return;
    const result = readResult(file);
    expect(verifyResult(result, { ...context, fileName: file })).toEqual([]);
  });

  it("measures the current vocabulary in the latest held-out result", () => {
    const heldout = resultFiles(RESULTS).sort(
      (a, b) =>
        Number(a.split("/").at(-1)?.split("-")[0]) - Number(b.split("/").at(-1)?.split("-")[0]),
    );
    const latest = heldout.at(-1);
    if (latest === undefined) return;
    expect(readResult(latest).vocabularySha256).toBe(loadVocabulary("nsclc").sha256);
  });
});

describe("verifyResult", () => {
  const madeUpLabels: SearchLabels = {
    version: 1,
    snapshot: "2000-06",
    cancerType: "nsclc",
    labels: [
      { nctId: "NCT00000001", set: "heldout", relevant: true, reason: "made up" },
      { nctId: "NCT00000002", set: "dev", relevant: false, reason: "made up" },
    ],
  };
  const rows: SearchEvalResult["rows"] = [
    { nctId: "NCT00000001", set: "heldout", relevant: true, kept: true, reasons: ["names"] },
    { nctId: "NCT00000002", set: "dev", relevant: false, kept: false, reasons: [] },
  ];
  const sha = createHash("sha256").update("x").digest("hex");
  const good: SearchEvalResult = {
    version: 1,
    cancerType: "nsclc",
    snapshot: { month: "2000-06", sha256: "snap" },
    vocabularySha256: sha,
    labelsSha256: "labels",
    rows,
    heldout: metricsFor(rows.filter((r) => r.set === "heldout")),
    dev: metricsFor(rows.filter((r) => r.set === "dev")),
  };
  const ctx = {
    labels: madeUpLabels,
    labelsSha256: "labels",
    snapshotSha256: "snap",
    fileName: `01-${sha.slice(0, 12)}.json`,
  };

  it("passes a result that is what it says it is", () => {
    expect(verifyResult(good, ctx)).toEqual([]);
  });

  it("catches tampered metrics, a changed label, and wrong checksums or file name", () => {
    expect(
      verifyResult(
        {
          ...good,
          heldout: { ...(good.heldout as NonNullable<typeof good.heldout>), recall: 0.5 },
        },
        ctx,
      ),
    ).toContain("held-out metrics don't follow from the rows");
    expect(
      verifyResult({ ...good, rows: [{ ...rows[0]!, relevant: false }, rows[1]!] }, ctx).join(" "),
    ).toMatch(/doesn't match its committed label/);
    expect(verifyResult(good, { ...ctx, labelsSha256: "other" })).toContain(
      "labelsSha256 isn't the committed label file's",
    );
    expect(verifyResult(good, { ...ctx, snapshotSha256: "other" })).toContain(
      "snapshot sha256 isn't the committed snapshot's",
    );
    expect(verifyResult(good, { ...ctx, fileName: "01-000000000000.json" })).toContain(
      "file name doesn't carry the vocabulary's checksum",
    );
  });

  it("refuses held-out rows in a dev-only result", () => {
    expect(verifyResult({ ...good, heldout: null }, ctx)).toContain(
      "held-out rows in a dev-only result",
    );
  });
});
