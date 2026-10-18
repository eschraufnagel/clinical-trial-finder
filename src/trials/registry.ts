import { asRecord } from "./read.js";
import { NCT_ID } from "./reference.js";
import { trimStudy } from "./trim.js";
import type { Trial } from "./types.js";

/**
 * The requests to ClinicalTrials.gov: one study by ID (the prescreening
 * repository's slice 0013), and the pages and data timestamp the search
 * snapshot is fetched from (this repository's slice 0001).
 *
 * The one file outside `src/models/` that may reach the network, and only
 * this host. Scripts a person runs call it: `npm run fetch:trials` and
 * `npm run snapshot:fetch`. Nothing fetches in the background or at startup.
 * `tests/boundary.test.ts` holds this file to `fetch()` and to
 * `clinicaltrials.gov`, and every other file to the absolute rule.
 *
 * Full records are requested and trimmed by the caller rather than with the
 * API's `fields` parameter, so trimming stays in one tested place. Trimming
 * also drops the site contacts, which name real coordinators, before
 * anything is kept.
 */

export const REGISTRY_HOST = "clinicaltrials.gov";
const API = `https://clinicaltrials.gov/api/v2`;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The snapshot's search (spec 0001 §2.1), fixed: recruiting interventional
 * studies matching the registry's own `cancer` condition search, with at
 * least one US location, a thousand to a page.
 */
export const SNAPSHOT_QUERY =
  "query.cond=cancer&filter.overallStatus=RECRUITING" +
  "&filter.advanced=AREA%5BStudyType%5DINTERVENTIONAL%20AND%20AREA%5BLocationCountry%5D%22United%20States%22" +
  "&pageSize=1000&format=json";

/** Raised for a study the registry doesn't have, so a caller can add its own advice. */
export class StudyNotFoundError extends Error {
  constructor(nctId: string) {
    super(`ClinicalTrials.gov has no study ${nctId}.`);
    this.name = "StudyNotFoundError";
  }
}

export interface SnapshotPage {
  /** Full, untrimmed study records. */
  studies: unknown[];
  nextPageToken: string | null;
}

/**
 * `fetch` is a parameter so tests pass their own, and it keeps that name so the
 * boundary test's detector sees the call: a renamed `fetchImpl(` would slip
 * past a check that looks for `fetch(`.
 */
export async function fetchStudy(
  nctId: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<Trial> {
  if (!NCT_ID.test(nctId)) {
    throw new Error(`Not an NCT ID: ${JSON.stringify(nctId)}`);
  }
  const response = await request(`${API}/studies/${nctId}?format=json`, fetch);
  if (response.status === 404) {
    throw new StudyNotFoundError(nctId);
  }
  return trimStudy(await readJson(response), nctId);
}

/**
 * One page of the snapshot's search. The URL is built from `SNAPSHOT_QUERY`
 * and the registry's own page token only, so nothing a caller passes can
 * point it anywhere else.
 */
export async function fetchSnapshotPage(
  pageToken: string | null,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<SnapshotPage> {
  const token = pageToken === null ? "" : `&pageToken=${encodeURIComponent(pageToken)}`;
  const body = asRecord(
    await readJson(await request(`${API}/studies?${SNAPSHOT_QUERY}${token}`, fetch)),
  );
  const studies = body?.["studies"];
  if (!Array.isArray(studies)) {
    throw new Error("ClinicalTrials.gov sent a page with no studies list.");
  }
  const next = body?.["nextPageToken"];
  return { studies, nextPageToken: typeof next === "string" && next !== "" ? next : null };
}

/** The registry's `dataTimestamp`: when the data being served was last refreshed. */
export async function fetchDataTimestamp(
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const body = asRecord(await readJson(await request(`${API}/version`, fetch)));
  const stamp = body?.["dataTimestamp"];
  if (typeof stamp !== "string" || stamp === "") {
    throw new Error("ClinicalTrials.gov's version has no dataTimestamp.");
  }
  return stamp;
}

/** The request, with this file's timeout and the network failure worded once. */
async function request(url: string, fetch: typeof globalThis.fetch): Promise<Response> {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't reach ClinicalTrials.gov (${detail}).`);
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov answered HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("ClinicalTrials.gov sent something that isn't JSON.");
  }
}
