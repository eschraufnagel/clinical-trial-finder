import { describe, expect, it } from "vitest";
import { devPool, heldOutSample, mentionsButDoesNotName } from "../../scripts/search-sample.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";

/** Made-up trials. Only the fields the sampling reads matter. */
function trial(
  nctId: string,
  overrides: Partial<SnapshotTrial> = {},
  rules = "Adults.",
): SnapshotTrial {
  return {
    nctId,
    briefTitle: "Made-up trial",
    officialTitle: null,
    overallStatus: "RECRUITING",
    phases: [],
    primaryPurpose: "TREATMENT",
    conditions: ["Advanced Solid Tumor"],
    keywords: [],
    conditionMesh: [],
    conditionAncestors: [],
    interventions: [],
    leadSponsor: "Example Sponsor",
    lastUpdatePostDate: "2000-01-01",
    completionDate: null,
    eligibility: {
      criteriaText: rules,
      sex: "ALL",
      minimumAge: null,
      maximumAge: null,
      healthyVolunteers: null,
      stdAges: [],
    },
    sites: [],
    ...overrides,
  };
}

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `NCT${String(i + 1).padStart(8, "0")}`);

describe("heldOutSample", () => {
  it("draws treatment trials only, the same ones whatever the input order", () => {
    const trials = [
      ...ids(20).map((id) => trial(id)),
      trial("NCT90000001", { primaryPurpose: "SUPPORTIVE_CARE" }),
      trial("NCT90000002", { primaryPurpose: null }),
    ];
    const a = heldOutSample(trials, 10);
    const b = heldOutSample([...trials].reverse(), 10);

    expect(a).toHaveLength(10);
    expect(a).toEqual(b);
    expect(heldOutSample(trials, 100)).not.toContain("NCT90000001");
    expect(heldOutSample(trials, 100)).toContain("NCT90000002");
  });
});

describe("the dev pool's rule", () => {
  it("takes trials that mention NSCLC in their rules but don't name the lung in their conditions", () => {
    expect(
      mentionsButDoesNotName(trial("NCT00000001", {}, "Cohort B: non-small cell lung cancer")),
    ).toBe(true);
    expect(mentionsButDoesNotName(trial("NCT00000001", { briefTitle: "A study in NSCLC" }))).toBe(
      true,
    );
    expect(
      mentionsButDoesNotName(
        trial("NCT00000001", { conditions: ["Lung Cancer"] }, "non-small cell lung cancer"),
      ),
    ).toBe(false);
    expect(
      mentionsButDoesNotName(trial("NCT00000001", { conditionMesh: ["Lung Neoplasms"] }, "NSCLC")),
    ).toBe(false);
    expect(mentionsButDoesNotName(trial("NCT00000001", {}, "Prostate cancer only."))).toBe(false);
  });

  it("leaves out the held-out set and non-treatment trials, and caps the pool", () => {
    const mentions = ids(10).map((id) => trial(id, {}, "NSCLC cohort"));
    const supportive = trial("NCT90000001", { primaryPurpose: "SUPPORTIVE_CARE" }, "NSCLC");
    const pool = devPool([...mentions, supportive], new Set(["NCT00000001"]), 5);

    expect(pool).toHaveLength(5);
    expect(pool).not.toContain("NCT00000001");
    expect(pool).not.toContain("NCT90000001");
  });
});
