import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ConversationAnswer } from "../../src/check/carry.js";
import { readTrialFacts, runDirFor } from "../../src/facts/run.js";
import type { FactVocabulary } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { type ConversationResult, runConversation } from "../../src/questions/conversation.js";
import type { TrialInput } from "../../src/questions/select.js";
import {
  type ConversationSettings,
  loadConversationSettings,
} from "../../src/questions/settings.js";
import { trialsForSearch } from "../../src/questions/trials.js";
import { loadZipPoints, type Point } from "../../src/search/geo.js";
import { shortlistOf } from "../../src/shortlist/order.js";
import { loadSnapshot, type Snapshot } from "../../src/trials/snapshot-load.js";
import { fromKnowledge } from "../questions/arms.js";
import { loadPatients, type Patient, type PatientSet, replyFor } from "../questions/patients.js";

/**
 * The pairs slice 0007 measures (spec 0007 §2.2, §7.1): each made-up
 * patient's conversation, as 0003's conversation arm runs it at the frozen
 * settings and 0005's order, and the first three trials on its short list.
 * Deterministic: no model.
 *
 * The labels say, for each pair, whether the patient's record plainly fails
 * one of the trial's rules. They're written from the trial's text and the
 * patient's file alone, before anything parses a trial or runs a check, by
 * the convention in `evals/cases/check/LABELLING.md`.
 */

export const PICKS = 3;
export const PAIR_LABELS_PATH = fileURLToPath(
  new URL("../cases/check/pairs.json", import.meta.url),
);
/** The committed held-out result whose short lists the picks must reproduce. */
export const QUESTIONS_RESULT_PATH = fileURLToPath(
  new URL("../results/questions/06-8eea38fafad5.json", import.meta.url),
);

export interface CheckContext {
  vocabulary: FactVocabulary;
  settings: ConversationSettings;
  zips: Map<string, Point>;
  snapshot: Snapshot;
  /** The mapping run, `data/facts/<month>/latest`. */
  runDir: string;
}

export function loadCheckContext(run?: string): CheckContext {
  const vocabulary = loadFactVocabulary();
  const snapshot = loadSnapshot();
  return {
    vocabulary,
    settings: loadConversationSettings(vocabulary),
    zips: loadZipPoints(),
    snapshot,
    runDir: runDirFor(snapshot.manifest.month, run),
  };
}

export interface PairPick {
  patient: string;
  set: PatientSet;
  nctId: string;
  /** 1 to `PICKS`, its place on the short list. */
  rank: number;
}

/** One patient's conversation, and what it hands a check: each fact asked, answered or not. */
export interface PatientConversation {
  patient: Patient;
  trials: TrialInput[];
  result: ConversationResult;
  answers: Map<string, ConversationAnswer>;
}

export function conversationFor(patient: Patient, ctx: CheckContext): PatientConversation {
  const trials = trialsForSearch(patient.search, ctx.snapshot, ctx.zips, (nctId) =>
    readTrialFacts(ctx.runDir, nctId),
  );
  const result = runConversation({
    trials,
    vocabulary: ctx.vocabulary,
    settings: ctx.settings,
    cancerType: patient.search.cancerType,
    sex: patient.search.sex,
    answer: (factId) => fromKnowledge(patient, factId),
  });
  const answers = new Map(
    result.steps.map((s) => [
      s.factId,
      { answer: s.reply, words: replyFor(patient, s.factId, ctx.vocabulary) },
    ]),
  );
  return { patient, trials, result, answers };
}

export function picksOf(conversation: PatientConversation, set: PatientSet): PairPick[] {
  return shortlistOf(conversation.result.order, PICKS).map((e, i) => ({
    patient: conversation.patient.id,
    set,
    nctId: e.candidate.nctId,
    rank: i + 1,
  }));
}

export function conversationsFor(set: PatientSet, ctx: CheckContext): PatientConversation[] {
  return loadPatients(set, ctx.vocabulary, ctx.zips).map((p) => conversationFor(p, ctx));
}

/**
 * Problems if the picks aren't the committed result's: each patient's
 * conversation-arm short list, under the `shortlist` scorer, first three.
 * The measurement is of those trials, and a drift in the snapshot, the
 * mapping run or the settings would quietly measure others.
 */
export function picksProblems(
  picks: readonly PairPick[],
  committed: {
    rows: ReadonlyArray<{
      patient: string;
      arm: string;
      scorer: string | null;
      shortlist: string[];
    }>;
  },
): string[] {
  const expected = new Map(
    committed.rows
      .filter((r) => r.arm === "conversation" && r.scorer === "shortlist")
      .map((r) => [r.patient, r.shortlist.slice(0, PICKS)]),
  );
  const got = new Map<string, string[]>();
  for (const p of picks) got.set(p.patient, [...(got.get(p.patient) ?? []), p.nctId]);
  return [...got].flatMap(([patient, ids]) => {
    const want = expected.get(patient);
    if (want === undefined) return [`${patient}: not in the committed result`];
    return want.join(" ") === ids.join(" ")
      ? []
      : [`${patient}: picks ${ids.join(", ")}, the committed result has ${want.join(", ")}`];
  });
}

export function readCommittedQuestionsResult(
  path = QUESTIONS_RESULT_PATH,
): Parameters<typeof picksProblems>[1] {
  return JSON.parse(readFileSync(path, "utf8")) as Parameters<typeof picksProblems>[1];
}

/** One pair's label. */
export interface PairLabel {
  patient: string;
  nctId: string;
  set: PatientSet;
  clearlyRuledOut: boolean;
  /** When `clearlyRuledOut`: the rule, verbatim, and why the record fails it. */
  rule?: {
    quote: string;
    /** The record facts that fail it; empty when it's the search's own fields (cancer type, age, sex). */
    facts: string[];
    why: string;
  };
}

export interface PairLabels {
  version: 1;
  pairs: PairLabel[];
}

/**
 * Problems with a label file, against the picks and the snapshot: a pair
 * missing or extra, a ruled-out pair with no rule, or a rule whose quote
 * isn't verbatim in the trial's criteria text.
 */
export function labelProblems(
  labels: PairLabels,
  picks: readonly PairPick[],
  textOf: (nctId: string) => string | undefined,
): string[] {
  const key = (p: { patient: string; nctId: string }) => `${p.patient} ${p.nctId}`;
  const wanted = new Set(picks.map(key));
  const have = new Set(labels.pairs.map(key));
  const problems = [
    ...[...wanted].filter((k) => !have.has(k)).map((k) => `${k}: no label`),
    ...[...have].filter((k) => !wanted.has(k)).map((k) => `${k}: labelled, but not a pick`),
  ];
  for (const l of labels.pairs) {
    if (labels.pairs.filter((x) => key(x) === key(l)).length > 1)
      problems.push(`${key(l)}: labelled twice`);
    if (!l.clearlyRuledOut) {
      if (l.rule !== undefined) problems.push(`${key(l)}: a rule on a pair not ruled out`);
      continue;
    }
    if (l.rule === undefined) {
      problems.push(`${key(l)}: clearly ruled out, with no rule`);
      continue;
    }
    const text = textOf(l.nctId);
    if (text === undefined) problems.push(`${key(l)}: not in the snapshot`);
    else if (!text.includes(l.rule.quote)) problems.push(`${key(l)}: the quote isn't in its text`);
    if (l.rule.why.trim() === "") problems.push(`${key(l)}: no reason given`);
  }
  return [...new Set(problems)];
}

export function readPairLabels(path = PAIR_LABELS_PATH): PairLabels {
  return JSON.parse(readFileSync(path, "utf8")) as PairLabels;
}
