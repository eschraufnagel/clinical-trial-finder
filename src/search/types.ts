import type { Reason } from "./vocabulary.js";

/** What a person asks the search for (spec 0001 §5). */
export interface SearchRequest {
  /** An id in `data/cancer-types/`, such as "nsclc". */
  cancerType: string;
  /** Whole years. */
  age: number;
  sex: "female" | "male";
  zip: string;
  /** Miles from the ZIP's point; `null` for anywhere in the US. */
  radiusMiles: number | null;
  /** Primary purposes to keep; "all" keeps every purpose. */
  purposes: readonly string[] | "all";
}

export type FunnelStage = "snapshot" | "purpose" | "cancer" | "age-and-sex" | "distance";

export type Flag =
  | "stale-record"
  | "past-completion"
  | "age-limit-unread"
  | "site-distance-unknown";

export interface NearestSite {
  facility: string | null;
  city: string | null;
  state: string | null;
  /** Whole miles, or `null` when the site has no coordinates. */
  miles: number | null;
}

export interface Candidate {
  nctId: string;
  briefTitle: string;
  phases: string[];
  reasons: Reason[];
  nearestSite: NearestSite | null;
  flags: Flag[];
}

export interface SearchResult {
  snapshot: { month: string; dataTimestamp: string };
  request: SearchRequest;
  funnel: { stage: FunnelStage; count: number }[];
  candidates: Candidate[];
}
