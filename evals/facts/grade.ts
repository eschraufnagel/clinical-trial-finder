import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { wilson } from "../search/metrics.js";
import type { FactLabels } from "./labels.js";

/**
 * Grades a mapping run against the hand labels (spec 0002 §6).
 *
 * A model mapping matches a labelled mapping when the fact is the same and
 * the model's quote overlaps the labelled passage by a character or more.
 * The most serious error is a wrong rule-out: an answer ruled out that the
 * trial accepts. That includes a whole-trial mapping for a rule the label
 * scopes to part of the trial, which would drop the whole trial for a rule
 * about one arm.
 *
 * Amended in plan (step 8): a mapping that overlaps no labelled mapping of
 * its fact is compared with that fact's other labelled mappings in the same
 * trial, and marked `displaced`. A model quoting the exception sentence beside
 * a rule, with the right answers, has read the trial right. Without a match
 * there, a mapping over a labelled passage is wrong, and elsewhere unplaced.
 */

export type Grade = "exact" | "safe" | "wrong" | "unplaced";

export interface MappingRow {
  nctId: string;
  factId: string;
  rulesOut: string[];
  scoped: boolean;
  start: number;
  end: number;
  grade: Grade;
  /** Matched a labelled mapping of its fact on another passage of the trial. */
  displaced: boolean;
  /** The labelled mapping it was graded against, or null when none matched. */
  label: { passage: number; rulesOut: string[]; scoped: boolean } | null;
}

export interface LabelRow {
  nctId: string;
  passage: number;
  factId: string;
  rulesOut: string[];
  scoped: boolean;
  /** A model mapping matched it, exact or safe. */
  found: boolean;
}

export interface FactMetrics {
  trials: number;
  modelMappings: number;
  exact: number;
  safe: number;
  wrong: number;
  unplaced: number;
  /** wrong ÷ modelMappings. */
  wrongShare: number;
  wrongInterval: [number, number];
  /** Wrong mappings without a scope: they could drop the whole trial. */
  wrongWholeTrial: number;
  /** Trials with at least one wrong whole-trial mapping. */
  trialsWithWrongWholeTrial: number;
  labelled: number;
  found: number;
  /** found ÷ labelled. */
  recall: number;
  recallInterval: [number, number];
  /** exact ÷ (model mappings matched to a label). */
  exactShare: number;
  rejected: number;
  rejectedByReason: { reason: string; count: number }[];
}

export function gradeTrial(
  labels: FactLabels,
  facts: TrialFacts,
): { mappings: MappingRow[]; labels: LabelRow[] } {
  const labelled = labels.passages.flatMap((p, i) =>
    p.mappings.map((m) => ({ passage: i + 1, start: p.start, end: p.end, ...m })),
  );
  const foundIds = new Set<number>();

  const mappingRows = facts.mappings.map((m): MappingRow => {
    const scoped = m.appliesTo !== undefined;
    const sameFact = labelled
      .map((l, index) => ({ l, index }))
      .filter(({ l }) => l.factId === m.factId);
    const here = bestOf(
      sameFact.filter(({ l }) => overlaps(l, m)),
      m,
    );
    const elsewhere = here === undefined ? bestOf(sameFact, m) : undefined;
    const best =
      here ?? (elsewhere !== undefined && elsewhere.grade !== "wrong" ? elsewhere : undefined);
    if (best !== undefined) {
      const l = labelled[best.index];
      if (best.grade !== "wrong") foundIds.add(best.index);
      return row(
        facts.nctId,
        m,
        scoped,
        best.grade,
        here === undefined,
        l && {
          passage: l.passage,
          rulesOut: l.rulesOut,
          scoped: l.appliesTo !== null,
        },
      );
    }
    // No labelled mapping for this fact here. Over a labelled passage, it
    // rules out answers the label says the rule doesn't: wrong.
    const onPassage = labels.passages.some((p) => overlaps(p, m));
    return row(facts.nctId, m, scoped, onPassage ? "wrong" : "unplaced", false, null);
  });

  const labelRows = labelled.map(
    (l, index): LabelRow => ({
      nctId: labels.nctId,
      passage: l.passage,
      factId: l.factId,
      rulesOut: l.rulesOut,
      scoped: l.appliesTo !== null,
      found: foundIds.has(index),
    }),
  );
  return { mappings: mappingRows, labels: labelRows };
}

export function metricsOf(
  mappingRows: readonly MappingRow[],
  labelRows: readonly LabelRow[],
  rejected: readonly { reason: string }[],
  trials: number,
): FactMetrics {
  const count = (g: Grade) => mappingRows.filter((r) => r.grade === g).length;
  const wrong = mappingRows.filter((r) => r.grade === "wrong");
  const wrongWhole = wrong.filter((r) => !r.scoped);
  const matched = mappingRows.filter((r) => r.label !== null).length;
  const found = labelRows.filter((r) => r.found).length;
  const reasons = new Map<string, number>();
  for (const r of rejected) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  return {
    trials,
    modelMappings: mappingRows.length,
    exact: count("exact"),
    safe: count("safe"),
    wrong: wrong.length,
    unplaced: count("unplaced"),
    wrongShare: ratio(wrong.length, mappingRows.length),
    wrongInterval: wilson(wrong.length, mappingRows.length),
    wrongWholeTrial: wrongWhole.length,
    trialsWithWrongWholeTrial: new Set(wrongWhole.map((r) => r.nctId)).size,
    labelled: labelRows.length,
    found,
    recall: ratio(found, labelRows.length),
    recallInterval: wilson(found, labelRows.length),
    exactShare: ratio(count("exact"), matched),
    rejected: rejected.length,
    rejectedByReason: [...reasons]
      .map(([reason, n]) => ({ reason, count: n }))
      .sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : 1)),
  };
}

const RANK: Record<Grade, number> = { exact: 0, safe: 1, wrong: 2, unplaced: 3 };

function bestOf(
  candidates: { l: { rulesOut: string[]; appliesTo: string | null }; index: number }[],
  m: FactMapping,
): { grade: Grade; index: number } | undefined {
  let best: { grade: Grade; index: number } | undefined;
  for (const { l, index } of candidates) {
    const grade = gradeAgainst(m, l.rulesOut, l.appliesTo !== null);
    if (best === undefined || RANK[grade] < RANK[best.grade]) best = { grade, index };
  }
  return best;
}

function gradeAgainst(m: FactMapping, labelRulesOut: string[], labelScoped: boolean): Grade {
  const allowed = new Set(labelRulesOut);
  if (m.rulesOut.some((a) => !allowed.has(a))) return "wrong";
  // A whole-trial mapping of a rule the label scopes would drop the whole trial.
  if (labelScoped && m.appliesTo === undefined) return "wrong";
  if (m.rulesOut.length === allowed.size && (m.appliesTo !== undefined) === labelScoped)
    return "exact";
  return "safe";
}

function overlaps(span: { start: number; end: number }, m: FactMapping): boolean {
  return m.source.start < span.end && span.start < m.source.end;
}

function row(
  nctId: string,
  m: FactMapping,
  scoped: boolean,
  grade: Grade,
  displaced: boolean,
  label: MappingRow["label"] | undefined,
): MappingRow {
  return {
    nctId,
    factId: m.factId,
    rulesOut: [...m.rulesOut].sort(),
    scoped,
    start: m.source.start,
    end: m.source.end,
    grade,
    displaced,
    label: label ?? null,
  };
}

function ratio(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 10_000) / 10_000;
}
