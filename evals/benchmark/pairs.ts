import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClinicianLabel, Label } from "./trialbench.js";

/**
 * The pairs the deeper check runs on (spec 0008 §7.1): every NCI pair a
 * clinician labelled ineligible, and 35 of the rest drawn by hash within
 * each label, split into dev and held-out by vignette so no vignette is in
 * both. Deterministic: the same labels always give the same pairs.
 */

export const BENCHMARK_CASES_DIR = fileURLToPath(new URL("../cases/benchmark", import.meta.url));
export const PAIRS_PATH = fileURLToPath(new URL("../cases/benchmark/pairs.json", import.meta.url));
export const REASONS_PATH = fileURLToPath(
  new URL("../cases/benchmark/reasons.json", import.meta.url),
);
export const ACCOUNTS_DIR = fileURLToPath(new URL("../cases/benchmark/accounts", import.meta.url));

/** The eligible pairs drawn per label: 274 : 86 of 35, rounded. */
export const ELIGIBLE_DRAW: Readonly<Record<Exclude<ClinicianLabel, "ineligible">, number>> = {
  recommended: 27,
  eligible_but_not_recommended: 8,
};

/** A vignette is dev when this hash's first byte is below 0x55, about one in three. */
export const DEV_CUT = 0x55;

export type BenchmarkSet = "dev" | "heldout";

export interface BenchmarkPair {
  patient: string;
  nctId: string;
  label: ClinicianLabel;
  set: BenchmarkSet;
}

const sha = (text: string) => createHash("sha256").update(text).digest();

export function splitOf(patient: string): BenchmarkSet {
  return (sha(`0008-split:${patient}`)[0] ?? 0) < DEV_CUT ? "dev" : "heldout";
}

const drawKey = (l: Pick<Label, "patient" | "nctId">) =>
  sha(`0008:${l.patient}:${l.nctId}`).toString("hex");

export function drawPairs(labels: readonly Label[]): BenchmarkPair[] {
  const byKey = (a: Label, b: Label) => (drawKey(a) < drawKey(b) ? -1 : 1);
  const chosen = [
    ...labels.filter((l) => l.label === "ineligible"),
    ...Object.entries(ELIGIBLE_DRAW).flatMap(([label, n]) =>
      labels
        .filter((l) => l.label === label)
        .sort(byKey)
        .slice(0, n),
    ),
  ];
  return chosen
    .map((l) => ({ patient: l.patient, nctId: l.nctId, label: l.label, set: splitOf(l.patient) }))
    .sort((a, b) =>
      a.patient === b.patient ? (a.nctId < b.nctId ? -1 : 1) : a.patient < b.patient ? -1 : 1,
    );
}

export interface PairsFile {
  note: string;
  pairs: BenchmarkPair[];
}

export function readPairs(path = PAIRS_PATH): BenchmarkPair[] {
  return (JSON.parse(readFileSync(path, "utf8")) as PairsFile).pairs;
}

/** What a clinician's comment on an ineligible pair says, read before any parse (§7.5). */
export interface PairReason {
  patient: string;
  nctId: string;
  /** "rule": the comment names one of the trial's rules; "disease": the trial is for another disease or purpose; "none": no rule named. */
  kind: "rule" | "disease" | "none";
  /** For "rule": the rule, verbatim from the trial's criteria text. */
  quote?: string;
  /** Where reading the comment against the trial's text needed a word of explanation. */
  note?: string;
}

export function readReasons(path = REASONS_PATH): PairReason[] {
  return (JSON.parse(readFileSync(path, "utf8")) as { reasons: PairReason[] }).reasons;
}

export const accountPath = (patient: string) => `${ACCOUNTS_DIR}/${patient}.md`;

/** Every way the reasons and accounts fall short of the pairs; empty when they don't. */
export function inputProblems(
  pairs: readonly BenchmarkPair[],
  reasons: readonly PairReason[],
  criteria: ReadonlyMap<string, string>,
  hasAccount: (patient: string) => boolean = (p) => existsSync(accountPath(p)),
): string[] {
  const problems: string[] = [];
  const key = (p: { patient: string; nctId: string }) => `${p.patient} × ${p.nctId}`;
  const ineligible = new Set(pairs.filter((p) => p.label === "ineligible").map(key));
  const seen = new Set<string>();
  for (const r of reasons) {
    if (!ineligible.has(key(r)))
      problems.push(`${key(r)} has a reason but isn't an ineligible pair.`);
    if (seen.has(key(r))) problems.push(`${key(r)} has two reasons.`);
    seen.add(key(r));
    if (r.kind === "rule") {
      const text = criteria.get(r.nctId) ?? "";
      if (r.quote === undefined || r.quote === "" || !text.includes(r.quote)) {
        problems.push(`${key(r)}'s quote isn't in its trial's criteria.`);
      }
    } else if (r.quote !== undefined) {
      problems.push(`${key(r)} is "${r.kind}" but has a quote.`);
    }
  }
  for (const k of ineligible) if (!seen.has(k)) problems.push(`${k} has no reason.`);
  for (const patient of new Set(pairs.map((p) => p.patient))) {
    if (!hasAccount(patient)) problems.push(`${patient} has no account.`);
  }
  return problems;
}
