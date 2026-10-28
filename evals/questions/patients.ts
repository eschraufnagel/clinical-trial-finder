import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactVocabulary, WhoKnows } from "../../src/facts/types.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import type { Point } from "../../src/search/geo.js";

/**
 * Made-up patients for slice 0003's measurement (spec 0003 §5): a search, an
 * answer for every fact in their record, which of those they know, and how
 * they'd say each one. The convention is `evals/cases/patients/AUTHORING.md`.
 *
 * Reaches neither the reader nor a model (`tests/boundary.test.ts`): the
 * patients are written, and checked, before anything reads them.
 */

export const PATIENTS_DIR = fileURLToPath(new URL("../cases/patients", import.meta.url));

export type PatientSet = "dev" | "heldout";

export interface PatientSearch {
  cancerType: string;
  zip: string;
  /** `null` for anywhere in the US. */
  radiusMiles: number | null;
  age: number;
  sex: "female" | "male";
}

export interface Patient {
  id: string;
  persona: string;
  search: PatientSearch;
  /** Every fact for the cancer type: an answer id, or `null` when the record doesn't hold it. */
  record: Record<string, string | null>;
  /** Non-null record facts the person can answer themselves. */
  knows: string[];
  /** For each fact in `knows`, the person's reply. */
  says: Record<string, string>;
  /** For some facts outside `knows`, a specific way of not knowing. */
  dontKnow?: Record<string, string>;
  /** General ways of not knowing, used in turn for the rest. */
  dontKnowPhrases: string[];
}

export class PatientError extends Error {
  constructor(problems: readonly string[]) {
    super(`Invalid patients:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "PatientError";
  }
}

/**
 * The set a patient belongs to, from a hash of its id, so the author doesn't
 * choose: dev when the hash's first byte is below 64, about a quarter.
 */
export function setFor(id: string): PatientSet {
  const [first = 0] = createHash("sha256").update(id).digest();
  return first < 64 ? "dev" : "heldout";
}

/** Driver mutations, at most one of which a record may hold (AUTHORING.md Rule 1). */
const DRIVERS: Readonly<Record<string, readonly string[]>> = {
  egfr: ["common_sensitizing", "exon20_insertion", "other_mutation"],
  alk: ["found"],
  ros1: ["found"],
  ret: ["found"],
  ntrk: ["found"],
  braf_v600e: ["found"],
  met: ["exon14_skipping"],
  kras: ["g12c", "other_mutation"],
};

/** The drivers a record holds. */
export function driversFound(record: Readonly<Record<string, string | null>>): string[] {
  return Object.entries(DRIVERS)
    .filter(([factId, answers]) => {
      const answer = record[factId];
      return answer != null && answers.includes(answer);
    })
    .map(([factId]) => factId);
}

/** Every problem with one patient, prefixed by where it is. */
export function patientProblems(
  value: unknown,
  where: string,
  vocabulary: FactVocabulary,
  zips: ReadonlyMap<string, Point>,
): string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(`${where}: ${problem}`);
  if (!isRecord(value)) {
    say("not a JSON object");
    return problems;
  }

  if (typeof value["id"] !== "string" || value["id"] !== basename(where, ".json"))
    say("id doesn't match the file name");
  if (typeof value["persona"] !== "string" || value["persona"].trim() === "")
    say("persona is missing");

  const search = value["search"];
  let cancerType = "nsclc";
  if (!isRecord(search)) say("search is not an object");
  else {
    if (typeof search["cancerType"] === "string") cancerType = search["cancerType"];
    else say("search.cancerType is not a string");
    if (typeof search["zip"] !== "string" || !zips.has(search["zip"]))
      say(`search.zip ${String(search["zip"])} isn't in the gazetteer`);
    const radius = search["radiusMiles"];
    if (radius !== null && !(typeof radius === "number" && radius > 0))
      say("search.radiusMiles is not a positive number or null");
    const age = search["age"];
    if (!(typeof age === "number" && Number.isInteger(age) && age >= 18 && age <= 100))
      say("search.age is not a whole number from 18 to 100");
    if (search["sex"] !== "female" && search["sex"] !== "male")
      say("search.sex is not female or male");
  }

  const facts = factsFor(vocabulary, cancerType);
  const record = value["record"];
  const known = new Set<string>();
  if (!isRecord(record)) say("record is not an object");
  else {
    for (const fact of facts) {
      if (!(fact.id in record)) {
        say(`record is missing ${fact.id}`);
        continue;
      }
      const answer = record[fact.id];
      if (answer === null) continue;
      if (typeof answer !== "string" || !fact.answers.some((a) => a.id === answer))
        say(`record.${fact.id} has no answer ${String(answer)}`);
      else known.add(fact.id);
    }
    for (const factId of Object.keys(record)) {
      if (!facts.some((f) => f.id === factId))
        say(`record.${factId} isn't a fact for ${cancerType}`);
    }
    const typed = record as Record<string, string | null>;
    const drivers = driversFound(typed);
    if (drivers.length > 1) say(`record holds more than one driver: ${drivers.join(", ")}`);
    if (typed["prior_targeted"] === "received" && drivers.length === 0)
      say("record has a prior targeted drug with no driver found");
    if (typed["extent"] === "early_resectable" && typed["lines_advanced"] !== "zero")
      say("record is early and resectable with lines for advanced disease");
  }

  const knows = value["knows"];
  const knowsList: string[] = [];
  if (!Array.isArray(knows) || !knows.every((k) => typeof k === "string"))
    say("knows is not a list of fact ids");
  else {
    for (const factId of knows as string[]) {
      if (knowsList.includes(factId)) say(`knows lists ${factId} twice`);
      else if (!known.has(factId)) say(`knows lists ${factId}, which the record doesn't hold`);
      knowsList.push(factId);
    }
  }

  const says = value["says"];
  if (!isRecord(says)) say("says is not an object");
  else {
    for (const factId of knowsList) {
      const reply = says[factId];
      if (typeof reply !== "string" || reply.trim() === "") say(`says has no reply for ${factId}`);
    }
    for (const factId of Object.keys(says)) {
      if (!knowsList.includes(factId)) say(`says has a reply for ${factId}, which isn't in knows`);
    }
  }

  const dontKnow = value["dontKnow"];
  if (dontKnow !== undefined) {
    if (!isRecord(dontKnow)) say("dontKnow is not an object");
    else {
      for (const [factId, reply] of Object.entries(dontKnow)) {
        if (!facts.some((f) => f.id === factId)) say(`dontKnow.${factId} isn't a fact`);
        else if (knowsList.includes(factId)) say(`dontKnow.${factId} is a fact the person knows`);
        if (typeof reply !== "string" || reply.trim() === "") say(`dontKnow.${factId} is empty`);
      }
    }
  }

  const phrases = value["dontKnowPhrases"];
  if (
    !Array.isArray(phrases) ||
    phrases.length < 2 ||
    !phrases.every((p) => typeof p === "string" && p.trim() !== "")
  )
    say("dontKnowPhrases is not a list of two or more replies");

  return problems;
}

/** One patient file. Throws `PatientError` naming every problem. */
export function loadPatient(
  path: string,
  vocabulary: FactVocabulary,
  zips: ReadonlyMap<string, Point>,
): Patient {
  const [patient] = loadPatientFiles([path], vocabulary, zips);
  if (patient === undefined) throw new PatientError([`${path}: not loaded`]);
  return patient;
}

/** Every `.json` file in `dir`, sorted. Throws `PatientError` naming every problem in every file. */
export function loadPatientDir(
  dir: string,
  vocabulary: FactVocabulary,
  zips: ReadonlyMap<string, Point>,
): Patient[] {
  const files = readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => join(dir, n));
  return loadPatientFiles(files, vocabulary, zips);
}

/** One set's committed patients, each also checked to be in the set its hash sends it to. */
export function loadPatients(
  set: PatientSet,
  vocabulary: FactVocabulary,
  zips: ReadonlyMap<string, Point>,
  dir: string = PATIENTS_DIR,
): Patient[] {
  const patients = loadPatientDir(join(dir, set), vocabulary, zips);
  const problems = patients
    .filter((p) => setFor(p.id) !== set)
    .map((p) => `${p.id} is in ${set}, but its hash sends it to ${setFor(p.id)}`);
  if (problems.length > 0) throw new PatientError(problems);
  return patients;
}

function loadPatientFiles(
  files: readonly string[],
  vocabulary: FactVocabulary,
  zips: ReadonlyMap<string, Point>,
): Patient[] {
  const problems: string[] = [];
  const patients: Patient[] = [];
  for (const file of files) {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      problems.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const found = patientProblems(value, file, vocabulary, zips);
    if (found.length > 0) problems.push(...found);
    else patients.push(value as Patient);
  }
  if (problems.length > 0) throw new PatientError(problems);
  return patients;
}

/**
 * What the person says when asked about a fact: their reply if they know it,
 * else their specific way of not knowing it, else one of their general
 * phrases, chosen by the fact's place in the vocabulary so it's fixed.
 */
export function replyFor(patient: Patient, factId: string, vocabulary: FactVocabulary): string {
  const said = patient.says[factId] ?? patient.dontKnow?.[factId];
  if (said !== undefined) return said;
  const index = factsFor(vocabulary, patient.search.cancerType).findIndex((f) => f.id === factId);
  if (index < 0) throw new PatientError([`${patient.id}: ${factId} isn't a fact for its cancer`]);
  return patient.dontKnowPhrases[index % patient.dontKnowPhrases.length] ?? "";
}

export interface KnowledgeRate {
  whoKnows: WhoKnows;
  /** Non-null record facts. */
  held: number;
  known: number;
}

/** Of the non-null record facts, how many the patients know, by who usually knows (AUTHORING.md Rule 4). */
export function knowledgeRates(
  patients: readonly Patient[],
  vocabulary: FactVocabulary,
): KnowledgeRate[] {
  const rates: KnowledgeRate[] = (["patient", "oncologist", "records"] as const).map((w) => ({
    whoKnows: w,
    held: 0,
    known: 0,
  }));
  for (const patient of patients) {
    for (const fact of factsFor(vocabulary, patient.search.cancerType)) {
      const rate = rates.find((r) => r.whoKnows === fact.whoKnows);
      if (rate === undefined || patient.record[fact.id] == null) continue;
      rate.held++;
      if (patient.knows.includes(fact.id)) rate.known++;
    }
  }
  return rates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
