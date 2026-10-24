import type { Site, SnapshotTrial } from "../../src/trials/snapshot-types.js";

/** A made-up trial for search tests. Nothing here is a real study. */
export function trial(nctId: string, overrides: Partial<SnapshotTrial> = {}): SnapshotTrial {
  return {
    nctId,
    briefTitle: "Made-up trial",
    officialTitle: null,
    overallStatus: "RECRUITING",
    phases: ["PHASE2"],
    primaryPurpose: "TREATMENT",
    conditions: ["Prostate Cancer"],
    keywords: [],
    conditionMesh: [],
    conditionAncestors: [],
    interventions: [],
    leadSponsor: "Example Sponsor",
    lastUpdatePostDate: "2000-06-01",
    completionDate: "2003-01",
    eligibility: {
      criteriaText: "Adults with the cancer named in this trial.",
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: null,
      healthyVolunteers: false,
      stdAges: ["ADULT"],
    },
    sites: [site()],
    ...overrides,
  };
}

/** A recruiting site at a made-up hospital in Springfield, Illinois. */
export function site(overrides: Partial<Site> = {}): Site {
  return {
    facility: "Example Hospital",
    city: "Springfield",
    state: "Illinois",
    zip: "62701",
    status: "RECRUITING",
    lat: 39.800544,
    lon: -89.648894,
    ...overrides,
  };
}

export function rules(text: string): Partial<SnapshotTrial> {
  return {
    eligibility: {
      criteriaText: text,
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: null,
      healthyVolunteers: false,
      stdAges: ["ADULT"],
    },
  };
}
