import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";
import { serializeSnapshot, sha256Hex, writeSnapshot } from "../../src/trials/snapshot-write.js";
import { TrialFixtureError } from "../../src/trials/types.js";

/** Three made-up trials. Nothing here is a real study. */
function trial(nctId: string, overrides: Partial<SnapshotTrial> = {}): SnapshotTrial {
  return {
    nctId,
    briefTitle: `Made-up trial ${nctId}`,
    officialTitle: null,
    overallStatus: "RECRUITING",
    phases: ["PHASE2"],
    primaryPurpose: "TREATMENT",
    conditions: ["Advanced Solid Tumor"],
    keywords: [],
    conditionMesh: [],
    conditionAncestors: [],
    interventions: [{ type: "DRUG", name: "Drug A" }],
    leadSponsor: "Example Sponsor",
    lastUpdatePostDate: "2000-01-15",
    completionDate: "2001-06",
    eligibility: {
      criteriaText: "Inclusion Criteria:\n\n* Adults",
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: null,
      healthyVolunteers: false,
      stdAges: ["ADULT"],
    },
    sites: [
      {
        facility: "Example Hospital",
        city: "Springfield",
        state: "Illinois",
        zip: "62701",
        status: "RECRUITING",
        lat: 39.8,
        lon: -89.65,
      },
    ],
    ...overrides,
  };
}

const TRIALS = [trial("NCT00000003"), trial("NCT00000001"), trial("NCT00000002")];
const META = { dataTimestamp: "2000-01-20T09:00:05", query: "query.cond=cancer" };

function written(trials = TRIALS): string {
  const dir = mkdtempSync(join(tmpdir(), "snapshot-"));
  writeSnapshot(dir, trials, META);
  return dir;
}

function thrown(fn: () => unknown): TrialFixtureError {
  try {
    fn();
  } catch (error) {
    if (error instanceof TrialFixtureError) return error;
    throw error;
  }
  throw new Error("expected a TrialFixtureError");
}

/** Replaces the compressed lines, keeping the manifest's count and fixing its checksum. */
function replaceLines(dir: string, text: string, count?: number): void {
  const compressed = gzipSync(Buffer.from(text, "utf8"));
  writeFileSync(join(dir, "trials.jsonl.gz"), compressed);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  manifest.sha256 = sha256Hex(compressed);
  if (count !== undefined) manifest.count = count;
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
}

describe("writeSnapshot and loadSnapshot", () => {
  it("round-trips, sorted by NCT ID, with a manifest that describes the file", () => {
    const dir = written();
    const { manifest, trials } = loadSnapshot(dir);

    expect(trials.map((t) => t.nctId)).toEqual(["NCT00000001", "NCT00000002", "NCT00000003"]);
    expect(trials[0]).toEqual(trial("NCT00000001"));
    expect(manifest).toMatchObject({ version: 1, month: "2000-01", count: 3, query: META.query });
    expect(manifest.dataTimestamp).toBe(META.dataTimestamp);
    expect(manifest.sha256).toBe(sha256Hex(readFileSync(join(dir, "trials.jsonl.gz"))));
    expect(manifest.fields[0]).toBe("nctId");
  });

  it("writes the same bytes for the same trials, in any input order", () => {
    const a = readFileSync(join(written(), "trials.jsonl.gz"));
    const b = readFileSync(join(written([...TRIALS].reverse()), "trials.jsonl.gz"));
    expect(a.equals(b)).toBe(true);
  });

  it("writes keys in declaration order whatever order the object has", () => {
    const shuffled = Object.fromEntries(Object.entries(trial("NCT00000001")).reverse());
    const line = serializeSnapshot([shuffled as unknown as SnapshotTrial]);
    expect(Object.keys(JSON.parse(line))[0]).toBe("nctId");
  });

  it("refuses to write a duplicate", () => {
    expect(() => serializeSnapshot([trial("NCT00000001"), trial("NCT00000001")])).toThrow(
      /more than once/,
    );
  });

  it("refuses a file that doesn't match its checksum", () => {
    const dir = written();
    writeFileSync(join(dir, "trials.jsonl.gz"), gzipSync(Buffer.from("{}\n")));
    expect(thrown(() => loadSnapshot(dir)).problems[0]).toMatch(/sha256/);
  });

  it("refuses a count that disagrees", () => {
    const dir = written();
    replaceLines(dir, serializeSnapshot(TRIALS), 4);
    expect(thrown(() => loadSnapshot(dir)).problems[0]).toMatch(/3 trials, manifest says 4/);
  });

  it("refuses IDs out of order, and repeated, naming the line", () => {
    const lines = serializeSnapshot(TRIALS).split("\n");
    const dir = written();

    replaceLines(dir, `${lines[1]}\n${lines[0]}\n${lines[2]}\n`);
    const outOfOrder = thrown(() => loadSnapshot(dir));
    expect(outOfOrder.message).toMatch(/line 2/);
    expect(outOfOrder.problems[0]).toMatch(/comes after/);

    replaceLines(dir, `${lines[0]}\n${lines[0]}\n${lines[2]}\n`);
    expect(thrown(() => loadSnapshot(dir)).problems[0]).toMatch(/more than once/);
  });

  it("refuses a malformed line and an invalid trial, naming the line", () => {
    const lines = serializeSnapshot(TRIALS).split("\n");
    const dir = written();

    replaceLines(dir, `${lines[0]}\n{ not json\n${lines[2]}\n`);
    expect(thrown(() => loadSnapshot(dir)).message).toMatch(/Malformed JSON at .*line 2/);

    const broken = JSON.parse(lines[1] as string);
    broken.sites[0].lat = "north";
    delete broken.briefTitle;
    replaceLines(dir, `${lines[0]}\n${JSON.stringify(broken)}\n${lines[2]}\n`);
    const invalid = thrown(() => loadSnapshot(dir));
    expect(invalid.message).toMatch(/line 2/);
    expect(invalid.problems).toEqual([
      "briefTitle is missing or not a non-empty string",
      "sites[0].lat is not a number or null",
    ]);
  });

  it("says how to make a snapshot when there is none", () => {
    const dir = mkdtempSync(join(tmpdir(), "snapshot-"));
    expect(thrown(() => loadSnapshot(dir)).problems[0]).toMatch(/snapshot:fetch/);
  });
});
