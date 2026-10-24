import type { TrialEligibility } from "./types.js";

/**
 * One trial in the search snapshot (spec 0001 §2.2): the fields the search
 * reads, plus the interventions and completion date later slices show.
 *
 * Contacts, officials, outcomes and arms are dropped when the study is
 * trimmed. Contacts name real coordinators, and nothing here uses them.
 *
 * Field order is load-bearing, as in `Trial`: the snapshot is written in
 * declaration order, so an unchanged study serializes to the same line.
 */
export interface SnapshotTrial {
  nctId: string;
  briefTitle: string;
  officialTitle: string | null;
  overallStatus: string;
  phases: string[];
  /** `designModule.designInfo.primaryPurpose`, such as `TREATMENT`. */
  primaryPurpose: string | null;
  conditions: string[];
  keywords: string[];
  /** `derivedSection.conditionBrowseModule.meshes[].term`. */
  conditionMesh: string[];
  /** `derivedSection.conditionBrowseModule.ancestors[].term`. */
  conditionAncestors: string[];
  interventions: Intervention[];
  leadSponsor: string;
  /** As the registry gives it. */
  lastUpdatePostDate: string;
  /** `statusModule.completionDateStruct.date`, as given: `2027-06` or `2027-06-30`. */
  completionDate: string | null;
  /** The criteria text verbatim, and the structured limits, as `Trial` keeps them. */
  eligibility: TrialEligibility;
  /** United States locations only. */
  sites: Site[];
}

export interface Intervention {
  type: string | null;
  name: string;
}

export interface Site {
  facility: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** The site's own recruitment status, such as `RECRUITING`. */
  status: string | null;
  lat: number | null;
  lon: number | null;
}

/** What a committed snapshot is and how to check it (spec 0001 §2.3). */
export interface SnapshotManifest {
  version: 1;
  /** `dataTimestamp.slice(0, 7)`: the registry's month, never the clock. */
  month: string;
  /** The registry's `/version` `dataTimestamp`, as given. */
  dataTimestamp: string;
  /** The exact query string the snapshot was fetched with. */
  query: string;
  count: number;
  /** Of `trials.jsonl.gz`, hex. */
  sha256: string;
  /** `SnapshotTrial`'s keys, so a reader knows the shape without the code. */
  fields: string[];
}

export const SNAPSHOT_FIELDS: readonly (keyof SnapshotTrial)[] = [
  "nctId",
  "briefTitle",
  "officialTitle",
  "overallStatus",
  "phases",
  "primaryPurpose",
  "conditions",
  "keywords",
  "conditionMesh",
  "conditionAncestors",
  "interventions",
  "leadSponsor",
  "lastUpdatePostDate",
  "completionDate",
  "eligibility",
  "sites",
];

export const SNAPSHOT_FILE = "trials.jsonl.gz";
export const MANIFEST_FILE = "manifest.json";
