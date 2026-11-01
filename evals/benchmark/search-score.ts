import { createHash } from "node:crypto";
import type { Point } from "../../src/search/geo.js";
import type { Others } from "../../src/search/other.js";
import { personStages, searchTrials } from "../../src/search/search.js";
import type { SearchRequest } from "../../src/search/types.js";
import { type Reason, reasonsFor, type Vocabulary } from "../../src/search/vocabulary.js";
import type { SnapshotManifest, SnapshotTrial } from "../../src/trials/snapshot-types.js";
import { wilson } from "../search/metrics.js";
import { type Judgment, type TrecJudgment, type TrecProfile, topicKey } from "./trec.js";
import type { Label, TrialBenchProfile, Vignette } from "./trialbench.js";

/**
 * The search scored against TREC's physicians (spec 0008 §3.4, §3.5). No model:
 * the result is fixed by the files it names, and a rerun reproduces it row for row.
 *
 * Each note runs the search's first three stages over its own judged trials,
 * with every purpose kept, its cancer type and its age and sex. A trial judged 1
 * (excluded) or 2 (eligible) is for the patient's condition, as
 * `data/benchmark/trec/README.md` says; that's the headline.
 */

export type DroppedAt = "cancer" | "age-and-sex";

export interface TrecRow {
  topic: string;
  nctId: string;
  judgment: Judgment;
  kept: boolean;
  /** Where a dropped trial left the search; null when kept. */
  droppedAt: DroppedAt | null;
  /** The cancer stage's reasons, also for a trial age or sex then dropped. */
  reasons: Reason[];
}

export interface Rate {
  n: number;
  kept: number;
  rate: number;
  interval: [number, number];
}

export interface TrecSummary {
  /** A note ("2021-1"), a cancer type, or "pooled". */
  name: string;
  notes: string[];
  /** Judged 1 or 2: the headline. */
  relevant: Rate;
  /** Judged 2. */
  eligible: Rate;
  /** Judged 0; not a precision. */
  notRelevant: Rate;
  /** Among kept trials judged 1 or 2. */
  byReason: Record<Reason, number>;
  /** Judged 1 or 2, kept by the cancer stage, dropped at age or sex. */
  droppedAtAgeOrSex: string[];
  /** Judged 1 or 2 and dropped, as "<note> <NCT ID>". */
  misses: string[];
}

export function rate(kept: number, n: number): Rate {
  return {
    n,
    kept,
    rate: n === 0 ? 0 : Math.round((kept / n) * 10_000) / 10_000,
    interval: wilson(kept, n),
  };
}

const isRelevant = (j: Judgment) => j === 1 || j === 2;

export function scoreTrecNote(
  topic: string,
  trials: readonly SnapshotTrial[],
  judgments: readonly TrecJudgment[],
  profile: Pick<TrecProfile, "age" | "sex">,
  vocabulary: Vocabulary,
): TrecRow[] {
  const byId = new Map(trials.map((t) => [t.nctId, t]));
  const judged = judgments.filter((j) => j.topic === topic);
  const pool = judged.map((j) => {
    const trial = byId.get(j.nctId);
    if (trial === undefined) throw new Error(`${j.nctId}, judged for ${topic}, has no trial.`);
    return trial;
  });
  const { entries } = personStages(pool, vocabulary, {
    age: profile.age,
    sex: profile.sex,
    purposes: "all",
  });
  const kept = new Set(entries.map((e) => e.trial.nctId));
  return judged.map((j) => {
    const reasons = reasonsFor(byId.get(j.nctId) as SnapshotTrial, vocabulary);
    const isKept = kept.has(j.nctId);
    return {
      topic,
      nctId: j.nctId,
      judgment: j.judgment,
      kept: isKept,
      droppedAt: isKept ? null : reasons.length === 0 ? "cancer" : "age-and-sex",
      reasons,
    };
  });
}

export function summarize(name: string, rows: readonly TrecRow[]): TrecSummary {
  const relevant = rows.filter((r) => isRelevant(r.judgment));
  const eligible = rows.filter((r) => r.judgment === 2);
  const notRelevant = rows.filter((r) => r.judgment === 0);
  const count = (list: readonly TrecRow[]) => list.filter((r) => r.kept).length;
  const keptRelevant = relevant.filter((r) => r.kept);
  const by = (reason: Reason) => keptRelevant.filter((r) => r.reasons.includes(reason)).length;
  const label = (r: TrecRow) => `${r.topic} ${r.nctId}`;
  return {
    name,
    notes: [...new Set(rows.map((r) => r.topic))],
    relevant: rate(count(relevant), relevant.length),
    eligible: rate(count(eligible), eligible.length),
    notRelevant: rate(count(notRelevant), notRelevant.length),
    byReason: { names: by("names"), rules: by("rules"), generic: by("generic") },
    droppedAtAgeOrSex: relevant.filter((r) => r.droppedAt === "age-and-sex").map(label),
    misses: relevant.filter((r) => !r.kept).map(label),
  };
}

export interface TrecSearchResult {
  version: 1;
  benchmark: "trec";
  /** No model is called, so none of model, quantization, temperature or seed applies. */
  model: null;
  sources: Record<string, string>;
  vocabularies: Record<string, string>;
  rows: TrecRow[];
  byNote: TrecSummary[];
  byType: TrecSummary[];
  pooled: TrecSummary;
}

export function scoreTrec(input: {
  trials: readonly SnapshotTrial[];
  judgments: readonly TrecJudgment[];
  profiles: readonly TrecProfile[];
  vocabularies: ReadonlyMap<string, Vocabulary>;
  sources: Record<string, string>;
}): TrecSearchResult {
  const rows: TrecRow[] = [];
  const byNote: TrecSummary[] = [];
  const typeOf = new Map<string, string>();
  for (const profile of input.profiles) {
    const topic = topicKey(profile.year, profile.number);
    const vocabulary = input.vocabularies.get(profile.cancerType);
    if (vocabulary === undefined) throw new Error(`No vocabulary for ${profile.cancerType}.`);
    const noteRows = scoreTrecNote(topic, input.trials, input.judgments, profile, vocabulary);
    rows.push(...noteRows);
    byNote.push(summarize(topic, noteRows));
    typeOf.set(topic, profile.cancerType);
  }
  const types = [...new Set(input.profiles.map((p) => p.cancerType))].sort();
  return {
    version: 1,
    benchmark: "trec",
    model: null,
    sources: input.sources,
    vocabularies: Object.fromEntries(
      types.map((t) => [t, input.vocabularies.get(t)?.sha256 ?? ""]),
    ),
    rows,
    byNote,
    byType: types.map((t) =>
      summarize(
        t,
        rows.filter((r) => typeOf.get(r.topic) === t),
      ),
    ),
    pooled: summarize("pooled", rows),
  };
}

/** The result's short name: the vocabularies it used, so a changed vocabulary is a new file. */
export function vocabulariesHash(vocabularies: Record<string, string>): string {
  const text = Object.entries(vocabularies)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([type, sha]) => `${type}\t${sha}\n`)
    .join("");
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

/** Where a trial left the full search, run over the snapshot. */
export type SnapshotDrop = "not-in-snapshot" | "purpose" | "cancer" | "age-and-sex" | "distance";

export interface TrialBenchTargetRow {
  patient: string;
  cancerType: string;
  nctId: string;
  /** With the page's purposes (treatment); null when kept. */
  droppedAt: SnapshotDrop | null;
  /** With every purpose; null when kept. */
  droppedAtAllPurposes: SnapshotDrop | null;
  reasons: Reason[];
}

export interface TrialBenchLabelRow extends TrialBenchTargetRow {
  label: string;
}

export interface TrialBenchSearchResult {
  version: 1;
  benchmark: "trialbench";
  model: null;
  sources: Record<string, string>;
  vocabularies: Record<string, string>;
  request: { zip: string; radiusMiles: null; purposes: string[] };
  targets: TrialBenchTargetRow[];
  labels: TrialBenchLabelRow[];
  summary: {
    /** Vignettes whose target is in the snapshot, and how many of those kept it. */
    targetKept: Rate;
    targetKeptAllPurposes: Rate;
    targetsNotInSnapshot: string[];
    /** Among targets kept, by reason. */
    byReason: Record<Reason, number>;
    /** Labelled pairs on trials in the snapshot, kept, by label. */
    labelsKept: Record<string, Rate>;
    labelsKeptAllPurposes: Record<string, Rate>;
  };
  /** Read by a person, not computed: why each target isn't in the snapshot. */
  notes: Record<string, string>;
}

/** Where `searchTrials` left a trial, given the candidates it kept. */
export function dropOf(
  trial: SnapshotTrial | undefined,
  candidates: ReadonlySet<string>,
  vocabulary: Vocabulary,
  request: Pick<SearchRequest, "age" | "sex" | "purposes">,
): SnapshotDrop | null {
  if (trial === undefined) return "not-in-snapshot";
  if (candidates.has(trial.nctId)) return null;
  const all = personStages([trial], vocabulary, { ...request, purposes: "all" });
  if (all.entries.length === 0) {
    return reasonsFor(trial, vocabulary).length === 0 ? "cancer" : "age-and-sex";
  }
  const asked = personStages([trial], vocabulary, request);
  return asked.entries.length === 0 ? "purpose" : "distance";
}

export function scoreTrialBench(input: {
  snapshot: {
    trials: readonly SnapshotTrial[];
    manifest: Pick<SnapshotManifest, "month" | "dataTimestamp">;
  };
  zipPoints: ReadonlyMap<string, Point>;
  vignettes: readonly Vignette[];
  profiles: readonly TrialBenchProfile[];
  labels: readonly Label[];
  vocabularies: ReadonlyMap<string, Vocabulary>;
  others: ReadonlyMap<string, Others | null>;
  sources: Record<string, string>;
  notes: Record<string, string>;
  /** Bethesda, where the NIH Clinical Center is (spec §6.1); a test passes its own. */
  zip?: string;
}): TrialBenchSearchResult {
  const zip = input.zip ?? "20814";
  const byId = new Map(input.snapshot.trials.map((t) => [t.nctId, t]));
  const profileOf = new Map(input.profiles.map((p) => [p.patient, p]));
  const targets: TrialBenchTargetRow[] = [];
  const labelRows: TrialBenchLabelRow[] = [];

  for (const v of input.vignettes) {
    const profile = profileOf.get(v.patient);
    if (profile === undefined) throw new Error(`${v.patient} has no profile.`);
    const vocabulary = input.vocabularies.get(profile.cancerType);
    if (vocabulary === undefined) throw new Error(`No vocabulary for ${profile.cancerType}.`);
    const base = { age: profile.age, sex: profile.sex };
    const kept = (purposes: SearchRequest["purposes"]) =>
      new Set(
        searchTrials(
          input.snapshot.trials,
          input.snapshot.manifest,
          vocabulary,
          input.zipPoints,
          { cancerType: profile.cancerType, zip, radiusMiles: null, purposes, ...base },
          input.others.get(profile.cancerType) ?? null,
        ).candidates.map((c) => c.nctId),
      );
    const treatment = kept(["TREATMENT"]);
    const every = kept("all");
    const row = (nctId: string): TrialBenchTargetRow => {
      const trial = byId.get(nctId);
      return {
        patient: v.patient,
        cancerType: profile.cancerType,
        nctId,
        droppedAt: dropOf(trial, treatment, vocabulary, { ...base, purposes: ["TREATMENT"] }),
        droppedAtAllPurposes: dropOf(trial, every, vocabulary, { ...base, purposes: "all" }),
        reasons: trial === undefined ? [] : reasonsFor(trial, vocabulary),
      };
    };
    targets.push(row(v.targetTrial));
    for (const l of input.labels.filter((x) => x.patient === v.patient)) {
      labelRows.push({ ...row(l.nctId), label: l.label });
    }
  }

  const inSnapshot = targets.filter((t) => t.droppedAt !== "not-in-snapshot");
  const keptTargets = inSnapshot.filter((t) => t.droppedAt === null);
  const by = (reason: Reason) => keptTargets.filter((t) => t.reasons.includes(reason)).length;
  const labelled = labelRows.filter((r) => r.droppedAt !== "not-in-snapshot");
  const perLabel = (key: "droppedAt" | "droppedAtAllPurposes") =>
    Object.fromEntries(
      ["recommended", "eligible_but_not_recommended", "ineligible"].map((label) => {
        const rows = labelled.filter((r) => r.label === label);
        return [label, rate(rows.filter((r) => r[key] === null).length, rows.length)];
      }),
    );
  const types = [...new Set(input.profiles.map((p) => p.cancerType))].sort();
  return {
    version: 1,
    benchmark: "trialbench",
    model: null,
    sources: input.sources,
    vocabularies: Object.fromEntries(
      types.map((t) => [t, input.vocabularies.get(t)?.sha256 ?? ""]),
    ),
    request: { zip, radiusMiles: null, purposes: ["TREATMENT"] },
    targets,
    labels: labelRows,
    summary: {
      targetKept: rate(keptTargets.length, inSnapshot.length),
      targetKeptAllPurposes: rate(
        inSnapshot.filter((t) => t.droppedAtAllPurposes === null).length,
        inSnapshot.length,
      ),
      targetsNotInSnapshot: [
        ...new Set(targets.filter((t) => t.droppedAt === "not-in-snapshot").map((t) => t.nctId)),
      ],
      byReason: { names: by("names"), rules: by("rules"), generic: by("generic") },
      labelsKept: perLabel("droppedAt"),
      labelsKeptAllPurposes: perLabel("droppedAtAllPurposes"),
    },
    notes: input.notes,
  };
}
