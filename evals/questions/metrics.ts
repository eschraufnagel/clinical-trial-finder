import type { StopReason } from "../../src/questions/select.js";
import { SCORERS, type ScorerName } from "../../src/questions/settings.js";
import type { PatientSet } from "./patients.js";

/**
 * The numbers of slice 0003's measurement (spec 0003 §6.2), from rows a run
 * writes. Pure, so a committed result's summaries can be re-derived from its
 * rows.
 */

/** Follow-ups the curve runs to, with the budget lifted. */
export const CURVE_LENGTH = 20;

export const ARMS = ["record", "intake", "conversation", "knows-all", "from-start"] as const;
export type ArmName = (typeof ARMS)[number];

export interface CurvePoint {
  agreement: number | null;
  wouldFlag: number | null;
}

export interface ArmRow {
  patient: string;
  set: PatientSet;
  arm: ArmName;
  /** `null` for the record and intake arms, which choose nothing. */
  scorer: ScorerName | null;
  candidates: number;
  /** Every question asked, intake included, with the reply: an answer id or "unknown". */
  asked: { factId: string; reply: string }[];
  followUps: number;
  /** Follow-ups that came back unknown. */
  dontKnows: number;
  stop: StopReason | null;
  /** The short list, in order. */
  shortlist: string[];
  /** On the record row: which of the trials on any of this patient's short lists the record flags. */
  recordFlagged?: string[];
  /** Share of the record arm's short list this short list holds. */
  agreement: number | null;
  /** Share of this short list the record profile gives a whole-trial hint. */
  wouldFlag: number | null;
  /** Trials in the short list with no answers that end below this one. */
  pushedDown: number;
  /** The hints those trials carry under this arm's answers. */
  pushedDownHints: number;
  /** Short-list places held by trials the run has no mappings for. */
  noMappingPlaces: number;
  /** Unanswered facts that short-list trials map: the oncologist sheet's length. */
  openQuestions: number;
  /** Agreement and would-flag after 0 to `CURVE_LENGTH` follow-ups, for the conversation arms. */
  curve: CurvePoint[] | null;
}

export function agreement(shortlist: readonly string[], record: readonly string[]): number | null {
  if (record.length === 0) return null;
  return shortlist.filter((id) => record.includes(id)).length / record.length;
}

export function wouldFlag(
  shortlist: readonly string[],
  flagged: ReadonlySet<string>,
): number | null {
  if (shortlist.length === 0) return null;
  return shortlist.filter((id) => flagged.has(id)).length / shortlist.length;
}

export interface ArmSummary {
  arm: ArmName;
  scorer: ScorerName | null;
  patients: number;
  /** Means over the patients, leaving out any with no value. */
  agreement: number | null;
  wouldFlag: number | null;
  followUps: number;
  dontKnows: number;
  stops: Partial<Record<StopReason, number>>;
  pushedDown: number;
  noMappingPlaces: number;
  openQuestions: number;
  curve: CurvePoint[] | null;
}

/** One summary per arm and scorer present in the rows, in a fixed order. */
export function summarize(rows: readonly ArmRow[]): ArmSummary[] {
  const summaries: ArmSummary[] = [];
  for (const arm of ARMS) {
    for (const scorer of [null, ...SCORERS]) {
      const group = rows.filter((r) => r.arm === arm && r.scorer === scorer);
      if (group.length === 0) continue;
      const stops: Partial<Record<StopReason, number>> = {};
      for (const r of group) if (r.stop !== null) stops[r.stop] = (stops[r.stop] ?? 0) + 1;
      const curves = group.map((r) => r.curve).filter((c): c is CurvePoint[] => c !== null);
      summaries.push({
        arm,
        scorer,
        patients: group.length,
        agreement: mean(group.map((r) => r.agreement)),
        wouldFlag: mean(group.map((r) => r.wouldFlag)),
        followUps: mean(group.map((r) => r.followUps)) ?? 0,
        dontKnows: sum(group.map((r) => r.dontKnows)),
        stops,
        pushedDown: sum(group.map((r) => r.pushedDown)),
        noMappingPlaces: sum(group.map((r) => r.noMappingPlaces)),
        openQuestions: mean(group.map((r) => r.openQuestions)) ?? 0,
        curve:
          curves.length === 0
            ? null
            : Array.from({ length: CURVE_LENGTH + 1 }, (_, k) => ({
                agreement: mean(curves.map((c) => c[k]?.agreement ?? null)),
                wouldFlag: mean(curves.map((c) => c[k]?.wouldFlag ?? null)),
              })),
      });
    }
  }
  return summaries;
}

function mean(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : sum(present) / present.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
