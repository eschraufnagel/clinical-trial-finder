import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCHMARK_DATA_DIR } from "./sources.js";
import { readTrialsGz } from "./trec.js";

/**
 * NIH-TrialBench's NCI vignettes, their clinician labels and the trials those
 * name (spec 0008 §2.3). Only NCI's rows are kept: NCI is the oncology share.
 *
 * A trial's title and criteria come from the release's
 * `raw/trial_search_space.jsonl`, the trial pool the clinicians worked from.
 * Conditions, phases, ages and sex aren't in it, so they come from the
 * release's `trials/NCT*.json`, the repository's updated copies.
 */

export const TRIALBENCH_DIR = join(BENCHMARK_DATA_DIR, "trialbench");
export const TRIALBENCH_PROFILES_PATH = join(TRIALBENCH_DIR, "profiles.json");

export const ONCOLOGY_IC = "NCI";

export type ClinicianLabel = "recommended" | "eligible_but_not_recommended" | "ineligible";
const LABELS: readonly ClinicianLabel[] = [
  "recommended",
  "eligible_but_not_recommended",
  "ineligible",
];

/** `raw/patients.jsonl`, one row. */
export interface PatientRow {
  patient_id: string;
  ic: string;
  patient_summary: string;
  target_trial_id: string;
}

/** `raw/clinician_annotations.jsonl`, one row. */
export interface AnnotationRow {
  patient_id: string;
  ic: string;
  annotations: { trial_id: string; clinician_label: string; clinician_comment: string }[];
}

/** `raw/trial_search_space.jsonl`, one row. */
export interface SearchSpaceRow {
  trial_id: string;
  trial_title: string;
  raw_criteria: string;
  study_type: string;
}

/** `trials/NCT*.json`, the fields used. */
export interface ReleaseTrial {
  nctid: string;
  title: string;
  condition: string[];
  phases: string[];
  minimum_age: string;
  maximum_age: string;
  sex: string;
  raw_criteria: string;
}

export interface Vignette {
  patient: string;
  ic: string;
  targetTrial: string;
  /** Verbatim. */
  summary: string;
}

export interface Label {
  patient: string;
  nctId: string;
  label: ClinicianLabel;
  /** Empty when the clinician wrote none. */
  comment: string;
}

/** A labelled trial, in the shape the parser reads (`ParseableTrial`) plus its limits. */
export interface BenchTrial {
  nctId: string;
  briefTitle: string;
  conditions: string[];
  phases: string[];
  minimumAge: string | null;
  maximumAge: string | null;
  sex: string;
  /** Verbatim from `trial_search_space.jsonl`. */
  criteriaText: string;
}

export interface TrialBenchData {
  vignettes: Vignette[];
  labels: Label[];
  trials: BenchTrial[];
}

export interface TrialBenchProfile {
  patient: string;
  cancerType: string;
  age: number;
  sex: "female" | "male";
  /** Present when the summary didn't state the age or sex, saying what was used. */
  note?: string;
}

export function readJsonl<T>(text: string): T[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

export function vignettesFrom(rows: readonly PatientRow[]): Vignette[] {
  return rows
    .filter((r) => r.ic === ONCOLOGY_IC)
    .map((r) => ({
      patient: r.patient_id,
      ic: r.ic,
      targetTrial: r.target_trial_id,
      summary: r.patient_summary,
    }));
}

export function labelsFrom(rows: readonly AnnotationRow[]): Label[] {
  return rows
    .filter((r) => r.ic === ONCOLOGY_IC)
    .flatMap((r) =>
      r.annotations.map((a) => {
        if (!LABELS.includes(a.clinician_label as ClinicianLabel)) {
          throw new Error(`${r.patient_id} × ${a.trial_id} has label "${a.clinician_label}".`);
        }
        return {
          patient: r.patient_id,
          nctId: a.trial_id,
          label: a.clinician_label as ClinicianLabel,
          comment: a.clinician_comment,
        };
      }),
    );
}

const ageOrNull = (age: string) => (age.trim() === "" ? null : age.trim());

export function benchTrialFrom(space: SearchSpaceRow, release: ReleaseTrial): BenchTrial {
  if (space.trial_id !== release.nctid) {
    throw new Error(`${space.trial_id}'s release file is for ${release.nctid}.`);
  }
  return {
    nctId: space.trial_id,
    briefTitle: space.trial_title,
    conditions: release.condition,
    phases: release.phases,
    minimumAge: ageOrNull(release.minimum_age),
    maximumAge: ageOrNull(release.maximum_age),
    sex: release.sex,
    criteriaText: space.raw_criteria,
  };
}

/** The committed NIH-TrialBench files, checked against each other. */
export function loadTrialBench(dir = TRIALBENCH_DIR): TrialBenchData {
  const vignettes = (
    JSON.parse(readFileSync(join(dir, "vignettes.json"), "utf8")) as { vignettes: Vignette[] }
  ).vignettes;
  const labels = (JSON.parse(readFileSync(join(dir, "labels.json"), "utf8")) as { labels: Label[] })
    .labels;
  const trials = readTrialsGz<BenchTrial>(join(dir, "trials.jsonl.gz"));
  const problems = trialBenchProblems({ vignettes, labels, trials });
  if (problems.length > 0) {
    throw new Error(`The NIH-TrialBench files don't agree:\n${problems.join("\n")}`);
  }
  return { vignettes, labels, trials };
}

export function trialBenchProblems(data: TrialBenchData): string[] {
  const problems: string[] = [];
  const patients = new Set(data.vignettes.map((v) => v.patient));
  const ids = new Set(data.trials.map((t) => t.nctId));
  for (const v of data.vignettes) {
    if (v.ic !== ONCOLOGY_IC) problems.push(`${v.patient} is from ${v.ic}, not NCI.`);
    if (!ids.has(v.targetTrial))
      problems.push(`${v.patient}'s target ${v.targetTrial} has no trial.`);
  }
  for (const l of data.labels) {
    if (!patients.has(l.patient))
      problems.push(`A label is for ${l.patient}, who has no vignette.`);
    if (!ids.has(l.nctId)) problems.push(`${l.patient} × ${l.nctId} has no trial.`);
  }
  return problems;
}

export function readTrialBenchProfiles(path = TRIALBENCH_PROFILES_PATH): TrialBenchProfile[] {
  return (JSON.parse(readFileSync(path, "utf8")) as { profiles: TrialBenchProfile[] }).profiles;
}
