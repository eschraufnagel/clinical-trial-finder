import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SnapshotTrial } from "../trials/snapshot-types.js";
import { containsTerm, normalizeText } from "./normalize.js";
import { DEFAULT_VOCABULARY_DIR, type Vocabulary, VocabularyError } from "./vocabulary.js";

/**
 * The mark on a trial whose record is about other cancers only (spec 0005
 * §4). Pure apart from `loadOthers`, which reads one file: no model, no
 * network, no clock.
 *
 * A mark never drops a trial. The search keeps what it kept, and the order
 * `other-last` moves a marked trial below every unmarked one. The words come
 * from `data/cancer-types/<type>-others.json`, apart from the type's own
 * vocabulary, so the vocabulary a result measured keeps its checksum.
 *
 * Amended in plan (step 7): the three listing routes share one test of the
 * conditions, and the route says which kind of listing it is; condition words
 * that name no cancer need no list, since anything the file doesn't name
 * counts as naming no cancer.
 */

export const ROUTES = ["small-cell", "biomarker", "listing", "rules"] as const;
export type OtherRoute = (typeof ROUTES)[number];

export interface OtherCancer {
  /** As a person reads it: "prostate cancer". */
  name: string;
  /** Matched as whole words, with the type's own names stripped first. */
  terms: string[];
}

export interface Others {
  /** The routes adopted: a candidate is marked only by one of these. Read as empty for the checksum. */
  routes: OtherRoute[];
  /** Names of this type itself, stripped before other cancers are sought: "non small cell lung". */
  typeTerms: string[];
  /** Phrases that contain a cancer's name but aren't one, stripped too: "kirsten rat sarcoma" is KRAS. */
  notCancerTerms: string[];
  /** Phrases that mention solid tumors without opening a trial to them: "response evaluation criteria in solid tumors". */
  notOpenTerms: string[];
  /** Words that may mean this type or another: "lung". A listing with one is never marked, unless it names small cell lung cancer. */
  ambiguousTerms: string[];
  otherCancers: OtherCancer[];
  /** Words in an inclusion section that open a trial beyond its named cancers. */
  openPhrases: string[];
  /** Words that make an inclusion line a required diagnosis. */
  diagnosisWords: string[];
  /** Of the file, with `routes` read as empty. */
  sha256: string;
}

export interface OtherMark {
  route: OtherRoute;
  /** The other cancers named, as the others file names them, in order of first appearance. */
  cancers: string[];
  /** The record's own words that decided it: conditions, or inclusion lines, verbatim. */
  evidence: string[];
}

/** The cancer-type others file, or `null` when the type has none. */
export function loadOthers(id: string, dir: string = DEFAULT_VOCABULARY_DIR): Others | null {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new VocabularyError(id, [`${JSON.stringify(id)} isn't a cancer type id`]);
  }
  const path = join(dir, `${id}-others.json`);
  let bytes: string;
  try {
    bytes = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(bytes);
  } catch {
    throw new VocabularyError(path, ["not a JSON object"]);
  }
  const others = validate(value, path);
  const neutral = JSON.stringify({ ...(value as object), routes: [] });
  return { ...others, sha256: createHash("sha256").update(neutral).digest("hex") };
}

function validate(value: unknown, path: string): Omit<Others, "sha256"> {
  const problems: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VocabularyError(path, ["not a JSON object"]);
  }
  const record = value as Record<string, unknown>;
  const routes = record["routes"];
  if (!Array.isArray(routes) || !routes.every((r) => ROUTES.includes(r as OtherRoute))) {
    problems.push(`routes must be a list of ${ROUTES.join(", ")}`);
  } else if (new Set(routes).size !== routes.length) {
    problems.push("routes repeats a route");
  }
  for (const field of [
    "typeTerms",
    "notCancerTerms",
    "notOpenTerms",
    "ambiguousTerms",
    "openPhrases",
    "diagnosisWords",
  ]) {
    terms(record[field], field, problems);
  }
  const cancers = record["otherCancers"];
  if (!Array.isArray(cancers) || cancers.length === 0) {
    problems.push("otherCancers is not a list");
  } else {
    const names = new Set<string>();
    cancers.forEach((c, i) => {
      const cancer = c as Partial<OtherCancer>;
      if (typeof cancer?.name !== "string" || cancer.name.trim() === "") {
        problems.push(`otherCancers[${i}] has no name`);
      } else if (names.has(cancer.name)) {
        problems.push(`otherCancers repeats ${JSON.stringify(cancer.name)}`);
      } else {
        names.add(cancer.name);
      }
      terms(cancer?.terms, `otherCancers[${i}].terms`, problems);
    });
  }
  if (problems.length > 0) throw new VocabularyError(path, problems);
  return record as unknown as Omit<Others, "sha256">;
}

/** A list of strings, none empty once normalized, none repeated. */
function terms(value: unknown, field: string, problems: string[]): void {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string")) {
    problems.push(`${field} is not a list of strings`);
    return;
  }
  const seen = new Set<string>();
  for (const term of value as string[]) {
    const key = normalizeText(term);
    if (key === " ") problems.push(`${field} has a term with no words: ${JSON.stringify(term)}`);
    else if (seen.has(key)) problems.push(`${field} repeats ${JSON.stringify(term)}`);
    seen.add(key);
  }
}

const SMALL_CELL = "small cell lung cancer";

/**
 * Normalized text with every name of the type itself taken out, so "non
 * small cell lung" can't read as "small cell lung", and every phrase that
 * isn't a cancer.
 */
function stripType(text: string, others: Others): string {
  let out = normalizeText(text);
  for (const term of [...others.typeTerms, ...others.notCancerTerms]) {
    const needle = normalizeText(term);
    while (out.includes(needle)) out = out.replace(needle, " ");
  }
  return out;
}

function namesType(text: string, others: Others): boolean {
  const normalized = normalizeText(text);
  return others.typeTerms.some((t) => containsTerm(normalized, t));
}

/** The other cancers a text names, in the file's order. */
function cancersIn(text: string, others: Others): string[] {
  const stripped = stripType(text, others);
  return others.otherCancers
    .filter((c) => c.terms.some((t) => containsTerm(stripped, t)))
    .map((c) => c.name);
}

type ConditionKind =
  | "type"
  | "other"
  | "ambiguous"
  | "generic-contained"
  | "generic-whole"
  | "none";

function kindOf(condition: string, others: Others, vocabulary: Vocabulary): ConditionKind {
  if (namesType(condition, others)) return "type";
  if (cancersIn(condition, others).length > 0) return "other";
  const normalized = normalizeText(condition);
  if (others.ambiguousTerms.some((t) => containsTerm(normalized, t))) return "ambiguous";
  if (vocabulary.generic.containedTerms.some((t) => containsTerm(normalized, t))) {
    return "generic-contained";
  }
  const whole = new Set(vocabulary.generic.wholeConditions.map(normalizeText));
  if (whole.has(normalized)) return "generic-whole";
  return "none";
}

/** The inclusion section: after a line naming inclusion criteria, before one naming exclusion criteria. `null` with no inclusion heading. */
export function inclusionSection(criteriaText: string): string[] | null {
  const lines = criteriaText.split("\n");
  const start = lines.findIndex((l) => /inclusion criteria/i.test(l));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /exclusion criteria/i.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).map((l) => l.trim()).filter((l) => l !== "");
}

/** Words that open a diagnosis line to cancers in general, whatever else it names. */
const OPEN_NOUNS = ["solid", "malignancy", "malignancies"];

/** A diagnosis line that names no other cancer but cancer in general: "confirmed cancer". */
const GENERAL_NOUNS = [
  "cancer",
  "cancers",
  "carcinoma",
  "malignancy",
  "malignancies",
  "tumor",
  "tumors",
  "tumour",
  "tumours",
  "neoplasm",
  "neoplasms",
];

/**
 * Every route that applies to a trial, in the fixed order. `other:eval`
 * scores each route on its own; a candidate's mark takes the first adopted
 * one (`markFor`).
 */
export function routesFor(
  trial: SnapshotTrial,
  vocabulary: Vocabulary,
  others: Others,
): { route: OtherRoute; cancers: string[]; evidence: string[] }[] {
  const listingFields = [
    ...trial.conditions,
    ...trial.keywords,
    trial.briefTitle,
    trial.officialTitle ?? "",
  ];
  if (listingFields.some((f) => namesType(f, others))) return [];

  const kinds = trial.conditions.map((c) => kindOf(c, others, vocabulary));
  const otherConditions = trial.conditions.filter((_, i) => kinds[i] === "other");
  const cancers = unique(otherConditions.flatMap((c) => cancersIn(c, others)));
  const found: { route: OtherRoute; cancers: string[]; evidence: string[] }[] = [];

  const smallCellOnly = cancers.length > 0 && cancers.every((c) => c === SMALL_CELL);
  // The inclusion section, or every rule when there's no heading, mustn't name the type: a listing can leave out a cohort its rules take.
  const included = inclusionSection(trial.eligibility.criteriaText) ?? [
    trial.eligibility.criteriaText,
  ];
  // A title open to solid tumors in general ("... in Advanced Solid Tumors") is a basket's, whatever its conditions list.
  const titles = [trial.briefTitle, trial.officialTitle ?? ""].map(normalizeText);
  const openTitle = titles.some(
    (t) =>
      vocabulary.generic.containedTerms.some((term) => containsTerm(t, term)) ||
      containsTerm(t, "solid"),
  );
  const listing =
    !openTitle &&
    !namesType(included.join("\n"), others) &&
    otherConditions.length > 0 &&
    !kinds.includes("generic-contained") &&
    (smallCellOnly || !kinds.includes("ambiguous"));
  if (listing) {
    found.push({
      route: smallCellOnly
        ? "small-cell"
        : namedByBiomarkerOnly(trial, vocabulary)
          ? "biomarker"
          : "listing",
      cancers,
      evidence: otherConditions,
    });
  }

  const rules = rulesRoute(trial, vocabulary, others, kinds);
  if (rules !== null) found.push(rules);
  return found;
}

/** The trial is in the search only because a condition or keyword names one of the type's biomarkers. */
function namedByBiomarkerOnly(trial: SnapshotTrial, vocabulary: Vocabulary): boolean {
  const { type } = vocabulary;
  const named = [
    ...trial.conditions,
    ...trial.keywords,
    trial.briefTitle,
    trial.officialTitle ?? "",
  ].map(normalizeText);
  const rules = normalizeText(trial.eligibility.criteriaText);
  const mesh = new Set(trial.conditionMesh);
  const tagged = [...trial.conditions, ...trial.keywords].map(normalizeText);
  return (
    !named.some((f) => type.names.some((t) => containsTerm(f, t))) &&
    !type.meshHeadings.some((h) => mesh.has(h)) &&
    !type.names.some((t) => containsTerm(rules, t)) &&
    tagged.some((f) => type.biomarkerNames.some((t) => containsTerm(f, t)))
  );
}

function rulesRoute(
  trial: SnapshotTrial,
  vocabulary: Vocabulary,
  others: Others,
  kinds: ConditionKind[],
): { route: OtherRoute; cancers: string[]; evidence: string[] } | null {
  if (!kinds.includes("generic-contained") && !kinds.includes("generic-whole")) return null;
  const inclusion = inclusionSection(trial.eligibility.criteriaText);
  if (inclusion === null) return null;

  const whole = normalizeText(inclusion.join("\n"));
  if (vocabulary.type.names.some((t) => containsTerm(whole, t))) return null;
  // "Lung" anywhere in the inclusion section, other than in small cell lung cancer, keeps the trial unmarked, whatever it refers to.
  const smallCell = others.otherCancers.find((c) => c.name === SMALL_CELL)?.terms ?? [];
  let open = whole;
  for (const term of smallCell) {
    const needle = normalizeText(term);
    while (open.includes(needle)) open = open.replace(needle, " ");
  }
  if (others.ambiguousTerms.some((t) => containsTerm(open, t))) return null;
  if (others.openPhrases.some((p) => containsTerm(whole, p))) return null;

  const diagnoses = inclusion.filter((line) => {
    const n = normalizeText(line);
    return others.diagnosisWords.some((w) => containsTerm(n, w));
  });
  const naming = diagnoses.filter((line) => cancersIn(line, others).length > 0);
  if (naming.length === 0) return null;
  // Any inclusion line open to solid tumors or malignancy in general opens the trial, even beside named cancers ("solid tumor ... other than breast"),
  // and so does a diagnosis line that names no other cancer but cancer in general ("confirmed cancer").
  const openLine = inclusion.some((line) => {
    let n = normalizeText(line);
    for (const term of others.notOpenTerms) {
      const needle = normalizeText(term);
      while (n.includes(needle)) n = n.replace(needle, " ");
    }
    return (
      vocabulary.generic.containedTerms.some((t) => containsTerm(n, t)) ||
      OPEN_NOUNS.some((t) => containsTerm(n, t))
    );
  });
  const general =
    openLine ||
    diagnoses.some(
      (line) =>
        cancersIn(line, others).length === 0 &&
        GENERAL_NOUNS.some((t) => containsTerm(normalizeText(line), t)),
    );
  if (general) return null;
  return {
    route: "rules",
    cancers: unique(naming.flatMap((l) => cancersIn(l, others))),
    // The line's words without its bullet or number: "* 2. Confirmed ..." is "Confirmed ...".
    evidence: naming.map((l) => l.replace(/^(?:[*•·\\-]+\s*|\d+[.)]\s*)+/, "")),
  };
}

/** The candidate's mark: the first adopted route that applies, or `null`. */
export function markFor(
  trial: SnapshotTrial,
  vocabulary: Vocabulary,
  others: Others,
): OtherMark | null {
  const adopted = routesFor(trial, vocabulary, others).find((r) => others.routes.includes(r.route));
  return adopted === undefined ? null : adopted;
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}
