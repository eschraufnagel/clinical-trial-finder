import { describe, expect, it } from "vitest";
import { compareSnapshots, describeDiff } from "../../scripts/fetch-snapshot.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";

/**
 * The fetch script's network path isn't tested: tests make no network calls.
 * Its comparison, which `--dry-run` reports, is.
 */
function trial(nctId: string, briefTitle = "Made-up trial"): SnapshotTrial {
  return {
    nctId,
    briefTitle,
    officialTitle: null,
    overallStatus: "RECRUITING",
    phases: [],
    primaryPurpose: "TREATMENT",
    conditions: [],
    keywords: [],
    conditionMesh: [],
    conditionAncestors: [],
    interventions: [],
    leadSponsor: "Example Sponsor",
    lastUpdatePostDate: "2000-01-01",
    completionDate: null,
    eligibility: {
      criteriaText: "x",
      sex: "ALL",
      minimumAge: null,
      maximumAge: null,
      healthyVolunteers: null,
      stdAges: [],
    },
    sites: [],
  };
}

describe("compareSnapshots", () => {
  it("names what was added, removed and changed", () => {
    const before = [trial("NCT00000001"), trial("NCT00000002"), trial("NCT00000003")];
    const after = [trial("NCT00000004"), trial("NCT00000002", "Retitled"), trial("NCT00000003")];

    expect(compareSnapshots(before, after)).toEqual({
      added: ["NCT00000004"],
      removed: ["NCT00000001"],
      changed: ["NCT00000002"],
    });
  });

  it("finds nothing between identical snapshots in different orders", () => {
    const a = [trial("NCT00000001"), trial("NCT00000002")];
    expect(compareSnapshots(a, [...a].reverse())).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe("describeDiff", () => {
  it("lists up to twenty IDs and counts the rest", () => {
    const ids = Array.from({ length: 23 }, (_, i) => `NCT${String(i).padStart(8, "0")}`);
    const lines = describeDiff({ added: ids, removed: [], changed: [] });

    expect(lines[0]).toMatch(/^ {2}added: 23 {2}NCT00000000 .* and 3 more$/);
    expect(lines[1]).toBe("  removed: 0");
  });
});
