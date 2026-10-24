import type { Site, SnapshotManifest, SnapshotTrial } from "../trials/snapshot-types.js";
import { milesBetween, type Point, pointForZip } from "./geo.js";
import type { Candidate, Flag, NearestSite, SearchRequest, SearchResult } from "./types.js";
import { reasonsFor, type Vocabulary } from "./vocabulary.js";

/**
 * The search (spec 0001 §5): the snapshot narrowed by purpose, cancer type,
 * age and sex, then distance, with the reason each trial was kept and flags
 * for records that look stale.
 *
 * Pure: it reads no file and no clock. Recall comes first, so anything the
 * record doesn't say keeps the trial: a missing purpose, an age limit that
 * doesn't read, a site with no coordinates. Flags never drop a trial.
 */
export function searchTrials(
  trials: readonly SnapshotTrial[],
  manifest: Pick<SnapshotManifest, "month" | "dataTimestamp">,
  vocabulary: Vocabulary,
  zipPoints: ReadonlyMap<string, Point>,
  request: SearchRequest,
): SearchResult {
  const origin = pointForZip(request.zip, zipPoints);
  const funnel: SearchResult["funnel"] = [{ stage: "snapshot", count: trials.length }];

  const byPurpose = trials.filter((t) => purposeMatches(t.primaryPurpose, request.purposes));
  funnel.push({ stage: "purpose", count: byPurpose.length });

  const byCancer = byPurpose
    .map((trial) => ({ trial, reasons: reasonsFor(trial, vocabulary) }))
    .filter(({ reasons }) => reasons.length > 0);
  funnel.push({ stage: "cancer", count: byCancer.length });

  const byPerson = byCancer
    .map((entry) => ({ ...entry, age: ageFits(entry.trial, request.age) }))
    .filter(({ trial, age }) => age !== "no" && sexFits(trial.eligibility.sex, request.sex));
  funnel.push({ stage: "age-and-sex", count: byPerson.length });

  const candidates: Candidate[] = [];
  for (const { trial, reasons, age } of byPerson) {
    const place = placeFor(trial.sites, origin, request.radiusMiles);
    if (place === undefined) continue;
    const flags: Flag[] = [...recordFlags(trial, manifest.dataTimestamp)];
    if (age === "unread") flags.push("age-limit-unread");
    if (place.distanceUnknown) flags.push("site-distance-unknown");
    candidates.push({
      nctId: trial.nctId,
      briefTitle: trial.briefTitle,
      phases: trial.phases,
      reasons,
      nearestSite: place.nearest,
      flags,
    });
  }
  funnel.push({ stage: "distance", count: candidates.length });

  candidates.sort(
    (a, b) =>
      milesOrLast(a) - milesOrLast(b) || (a.nctId < b.nctId ? -1 : a.nctId > b.nctId ? 1 : 0),
  );
  return {
    snapshot: { month: manifest.month, dataTimestamp: manifest.dataTimestamp },
    request,
    funnel,
    candidates,
  };
}

function purposeMatches(purpose: string | null, wanted: SearchRequest["purposes"]): boolean {
  if (wanted === "all") return true;
  if (purpose === null) return wanted.includes("TREATMENT");
  return wanted.includes(purpose);
}

const UNIT_YEARS: Record<string, number> = {
  year: 1,
  month: 1 / 12,
  week: 7 / 365.25,
  day: 1 / 365.25,
};

/**
 * A registry age limit in years: `null` when there is none, "unread" when it
 * doesn't read as `<number> <Years|Months|Weeks|Days>`.
 */
export function parseAgeLimit(limit: string | null): number | null | "unread" {
  if (limit === null) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s+(year|month|week|day)s?\s*$/i.exec(limit);
  const unit = match?.[2]?.toLowerCase();
  if (match?.[1] === undefined || unit === undefined) return "unread";
  return Number(match[1]) * (UNIT_YEARS[unit] ?? Number.NaN);
}

function ageFits(trial: SnapshotTrial, age: number): "yes" | "no" | "unread" {
  const min = parseAgeLimit(trial.eligibility.minimumAge);
  const max = parseAgeLimit(trial.eligibility.maximumAge);
  if (typeof min === "number" && age < min) return "no";
  if (typeof max === "number" && age > max) return "no";
  return min === "unread" || max === "unread" ? "unread" : "yes";
}

function sexFits(trialSex: string, sex: SearchRequest["sex"]): boolean {
  const value = trialSex.toUpperCase();
  if (value === "FEMALE") return sex === "female";
  if (value === "MALE") return sex === "male";
  return true;
}

/** Sites a person could enrol at now: recruiting, or with no status given. */
function counts(site: Site): boolean {
  return site.status === null || site.status === "RECRUITING";
}

/**
 * The trial's nearest counted site, or `undefined` when the trial is dropped
 * at the distance stage: no counted site, or none within the radius and none
 * whose distance is unknown.
 */
function placeFor(
  sites: readonly Site[],
  origin: Point,
  radius: number | null,
): { nearest: NearestSite; distanceUnknown: boolean } | undefined {
  const counted = sites.filter(counts);
  const known = counted
    .filter((s) => s.lat !== null && s.lon !== null)
    .map((s) => ({
      site: s,
      miles: Math.round(milesBetween(origin, { lat: s.lat as number, lon: s.lon as number })),
    }))
    .sort((a, b) => a.miles - b.miles);
  const unknown = counted.filter((s) => s.lat === null || s.lon === null);
  const closest = known[0];

  if (closest !== undefined && (radius === null || closest.miles <= radius)) {
    return { nearest: describe(closest.site, closest.miles), distanceUnknown: false };
  }
  const first = unknown[0];
  if (first !== undefined) {
    return { nearest: describe(first, null), distanceUnknown: true };
  }
  return undefined;
}

function describe(site: Site, miles: number | null): NearestSite {
  return { facility: site.facility, city: site.city, state: site.state, miles };
}

/**
 * Flags read against the registry's data timestamp, never the clock:
 * a record not updated in the 12 months before it, and a completion date
 * before it (a month-only date counts as that month's last day).
 */
export function recordFlags(trial: SnapshotTrial, dataTimestamp: string): Flag[] {
  const flags: Flag[] = [];
  const asOf = dataTimestamp.slice(0, 10);
  const year = Number(asOf.slice(0, 4));
  const yearBefore = `${year - 1}${asOf.slice(4)}`;
  if (fullDate(trial.lastUpdatePostDate, "first") < yearBefore) flags.push("stale-record");
  if (trial.completionDate !== null && fullDate(trial.completionDate, "last") < asOf) {
    flags.push("past-completion");
  }
  return flags;
}

/** `2027-06` as its first or last day; a full date unchanged. */
function fullDate(date: string, end: "first" | "last"): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{4}-\d{2}$/.test(date)) {
    if (end === "first") return `${date}-01`;
    const [y, m] = date.split("-").map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${date}-${String(last).padStart(2, "0")}`;
  }
  if (/^\d{4}$/.test(date)) return end === "first" ? `${date}-01-01` : `${date}-12-31`;
  return date;
}

function milesOrLast(candidate: Candidate): number {
  return candidate.nearestSite?.miles ?? Number.POSITIVE_INFINITY;
}
