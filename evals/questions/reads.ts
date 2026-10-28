import { readFileSync } from "node:fs";
import type { FactVocabulary } from "../../src/facts/types.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import type { ModelDescriptor } from "../../src/models/types.js";
import { UNKNOWN } from "../../src/questions/select.js";
import { wilson } from "../search/metrics.js";
import type { AnswerSource } from "./arms.js";
import { type Patient, type PatientSet, replyFor } from "./patients.js";

/**
 * The reader's readings of every patient's replies (spec 0003 §7.2), and how
 * they're graded (§7.3). A reads file holds one reading per (patient, fact):
 * every reply a conversation could ask for, so a conversation answered from
 * the readings needs no further model calls.
 */

export type ReplyKind = "says" | "dontKnow" | "phrase";

export interface ReadItem {
  patient: string;
  factId: string;
  kind: ReplyKind;
  reply: string;
  /** The record's answer for a reply in `says`; unknown for the rest. */
  expected: string;
  /** What the reader read. */
  answer: string;
  rejected?: string;
}

export interface ReadsFile {
  version: 1;
  set: PatientSet;
  run: ModelDescriptor & { promptVersion: string; timestamp: string };
  vocabularySha256: string;
  patientsSha256: string;
  items: ReadItem[];
  /** Pairs the adapter failed on, by `patient:factId`; retried on a rerun. */
  failures: Record<string, string>;
}

/** Every (patient, fact) pair to read, in patient then vocabulary order. */
export function pairsFor(
  patients: readonly Patient[],
  vocabulary: FactVocabulary,
): Omit<ReadItem, "answer" | "rejected">[] {
  return patients.flatMap((patient) =>
    factsFor(vocabulary, patient.search.cancerType).map((fact) => {
      const known = patient.knows.includes(fact.id);
      return {
        patient: patient.id,
        factId: fact.id,
        kind: known ? "says" : patient.dontKnow?.[fact.id] !== undefined ? "dontKnow" : "phrase",
        reply: replyFor(patient, fact.id, vocabulary),
        expected: known ? (patient.record[fact.id] ?? UNKNOWN) : UNKNOWN,
      } satisfies Omit<ReadItem, "answer" | "rejected">;
    }),
  );
}

export function readReadsFile(path: string): ReadsFile {
  return JSON.parse(readFileSync(path, "utf8")) as ReadsFile;
}

/** The person's answers as the reader read them. Throws on a pair the file lacks. */
export function fromReads(file: ReadsFile): AnswerSource {
  const byPair = new Map(file.items.map((i) => [`${i.patient}:${i.factId}`, i.answer]));
  return (patient, factId) => {
    const answer = byPair.get(`${patient.id}:${factId}`);
    if (answer === undefined)
      throw new Error(`The reads have no reading for ${patient.id} ${factId}`);
    return answer;
  };
}

export interface Rate {
  n: number;
  of: number;
  share: number | null;
  interval: [number, number] | null;
}

export interface ReadGrade {
  /** Replies stating the record's answer. */
  known: { items: number; exact: Rate; lost: Rate; wrong: Rate };
  /** Replies that don't know: the specific ones, the general phrases, and both. */
  dontKnow: { items: number; invented: Rate; inventedSpecific: Rate; inventedPhrase: Rate };
  rejected: number;
  inventions: ReadItem[];
  wrongs: ReadItem[];
}

function rate(n: number, of: number): Rate {
  return {
    n,
    of,
    share: of === 0 ? null : n / of,
    interval: of === 0 ? null : wilson(n, of),
  };
}

export function gradeReads(items: readonly ReadItem[]): ReadGrade {
  const known = items.filter((i) => i.kind === "says");
  const unknown = items.filter((i) => i.kind !== "says");
  const invented = (xs: readonly ReadItem[]) => xs.filter((i) => i.answer !== UNKNOWN);
  const wrongs = known.filter((i) => i.answer !== UNKNOWN && i.answer !== i.expected);
  const specific = unknown.filter((i) => i.kind === "dontKnow");
  const phrase = unknown.filter((i) => i.kind === "phrase");
  return {
    known: {
      items: known.length,
      exact: rate(known.filter((i) => i.answer === i.expected).length, known.length),
      lost: rate(known.filter((i) => i.answer === UNKNOWN).length, known.length),
      wrong: rate(wrongs.length, known.length),
    },
    dontKnow: {
      items: unknown.length,
      invented: rate(invented(unknown).length, unknown.length),
      inventedSpecific: rate(invented(specific).length, specific.length),
      inventedPhrase: rate(invented(phrase).length, phrase.length),
    },
    rejected: items.filter((i) => i.rejected !== undefined).length,
    inventions: invented(unknown),
    wrongs,
  };
}
