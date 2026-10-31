import type { SearchLabel } from "./labels.js";

/**
 * Slice 0005's measurement of trials for other cancers (spec 0005 §4.6, §8).
 * Pure: it reads no file. Every number is derived from committed results and
 * labels, so it can be re-derived.
 */

/** What this reads of a `questions:eval` row. */
export interface PlacesRow {
  patient: string;
  set: string;
  arm: string;
  scorer: string | null;
  shortlist: readonly string[];
}

export interface PlacesHeld {
  patient: string;
  set: string;
  arm: string;
  scorer: string | null;
  places: number;
  /** Places held by trials labelled not relevant, in short-list order. */
  notRelevant: string[];
  /** Places held by trials with no label in either file. */
  unlabelled: string[];
}

/** Per row of a questions result: the short-list places held by trials not for NSCLC, and by trials nobody labelled. */
export function placesHeld(
  rows: readonly PlacesRow[],
  labels: readonly Pick<SearchLabel, "nctId" | "relevant">[],
): PlacesHeld[] {
  const relevant = new Map(labels.map((l) => [l.nctId, l.relevant]));
  return rows.map((row) => ({
    patient: row.patient,
    set: row.set,
    arm: row.arm,
    scorer: row.scorer,
    places: row.shortlist.length,
    notRelevant: row.shortlist.filter((id) => relevant.get(id) === false),
    unlabelled: row.shortlist.filter((id) => typeof relevant.get(id) !== "boolean"),
  }));
}

export interface PlacesSummary {
  set: string;
  arm: string;
  scorer: string | null;
  patients: number;
  places: number;
  notRelevant: number;
  /** Patients whose short list holds at least one trial labelled not relevant. */
  patientsWithAny: number;
  unlabelled: number;
}

/** The rows summed by patient set, arm and scorer, in the order they first appear. */
export function summarizePlaces(held: readonly PlacesHeld[]): PlacesSummary[] {
  const groups = new Map<string, PlacesSummary>();
  for (const row of held) {
    const key = `${row.set}|${row.arm}|${row.scorer ?? ""}`;
    const group = groups.get(key) ?? {
      set: row.set,
      arm: row.arm,
      scorer: row.scorer,
      patients: 0,
      places: 0,
      notRelevant: 0,
      patientsWithAny: 0,
      unlabelled: 0,
    };
    group.patients += 1;
    group.places += row.places;
    group.notRelevant += row.notRelevant.length;
    group.patientsWithAny += row.notRelevant.length > 0 ? 1 : 0;
    group.unlabelled += row.unlabelled.length;
    groups.set(key, group);
  }
  return [...groups.values()];
}
