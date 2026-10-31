import { openQuestions } from "../questions/conversation.js";
import { type DescribeInput, describeOrder, type HintView, type TrialView } from "./explain.js";
import type { OrderEntry } from "./order.js";
import { ours, said, type Words } from "./words.js";

/**
 * The sheet for the person's oncologist (spec 0004 §6): what was asked and
 * answered, the questions that would settle the most short-list trials, what
 * to bring, and the short list with what may not fit. Pure. The person prints
 * or saves it; nothing here sends it anywhere.
 */

export interface SheetAnswer {
  factId: string;
  question: Words;
  /** The person's own words, or that they chose from a list. */
  said: Words;
  answer: Words;
}

export interface SheetQuestion {
  factId: string;
  question: Words;
  trials: number;
  count: Words;
}

export interface SheetBring {
  item: Words;
  /** The open questions it would answer. */
  answers: Words[];
}

export interface SheetTrial {
  nctId: string;
  title: Words;
  phase: Words;
  site: Words;
  read: Words;
  thin: Words | null;
  hints: HintView[];
  /** What its record names, on a trial the search marked as about other cancers only (slice 0005). */
  other: TrialView["other"];
}

export interface SheetView {
  title: Words;
  intro: Words;
  answersHeading: Words;
  answers: SheetAnswer[];
  questionsHeading: Words;
  questions: SheetQuestion[];
  bringHeading: Words;
  bring: SheetBring[];
  trialsHeading: Words;
  trials: SheetTrial[];
  closing: Words;
}

export interface SheetInput extends DescribeInput {
  /** Every fact asked, in the order asked, answered or not. */
  asked: readonly string[];
  /** The snapshot the search ran on, as `2026-10`. */
  snapshotMonth?: string;
}

/**
 * What would answer each open fact, for "what to bring". A fact not listed
 * is one the person can answer themselves, and brings nothing.
 */
export const BRING: Readonly<Record<string, string>> = {
  egfr: "The biomarker (genetic test) report on your tumor",
  alk: "The biomarker (genetic test) report on your tumor",
  ros1: "The biomarker (genetic test) report on your tumor",
  ret: "The biomarker (genetic test) report on your tumor",
  ntrk: "The biomarker (genetic test) report on your tumor",
  kras: "The biomarker (genetic test) report on your tumor",
  her2: "The biomarker (genetic test) report on your tumor",
  met: "The biomarker (genetic test) report on your tumor",
  braf_v600e: "The biomarker (genetic test) report on your tumor",
  pdl1: "The PD-L1 test result",
  histology: "The pathology report from your biopsy",
  extent: "Your latest scan reports",
  brain_mets: "Your latest scan reports",
  leptomeningeal: "Your latest scan reports",
  measurable_disease: "Your latest scan reports",
  prior_pd1: "A list of your treatments so far, with dates and how each ended",
  prior_platinum: "A list of your treatments so far, with dates and how each ended",
  prior_targeted: "A list of your treatments so far, with dates and how each ended",
  prior_adc: "A list of your treatments so far, with dates and how each ended",
  lines_advanced: "A list of your treatments so far, with dates and how each ended",
  chest_radiation_6m: "A list of your treatments so far, with dates and how each ended",
};

export function oncologistSheet(input: SheetInput): SheetView {
  const facts = new Map(input.vocabulary.facts.map((f) => [f.id, f]));
  const question = (factId: string) => ours(facts.get(factId)?.question ?? factId);
  const shortlist: readonly OrderEntry[] = input.order.slice(0, input.shortlistSize);
  const view = describeOrder(input);
  const skipped = input.skipped ?? [];

  const answers: SheetAnswer[] = input.asked
    .filter((f) => !skipped.includes(f))
    .map((factId) => {
      const answerId = input.profile[factId];
      const words = input.said?.[factId];
      return {
        factId,
        question: question(factId),
        said:
          words === undefined
            ? ours(answerId === undefined ? "Didn't know" : "Chose from a list")
            : said(words),
        answer: ours(
          answerId === undefined
            ? "Not known yet"
            : (facts.get(factId)?.answers.find((a) => a.id === answerId)?.words ?? answerId),
        ),
      };
    });

  const open = openQuestions(shortlist, input.profile, input.vocabulary, skipped);
  const questions: SheetQuestion[] = open.map(({ factId, trials }) => ({
    factId,
    question: question(factId),
    trials,
    count: ours(
      `${trials} of these ${shortlist.length} trials ${trials === 1 ? "asks" : "ask"} about this.`,
    ),
  }));

  const bringItems = new Map<string, Words[]>();
  for (const { factId } of open) {
    const item = BRING[factId];
    if (item === undefined) continue;
    bringItems.set(item, [...(bringItems.get(item) ?? []), question(factId)]);
  }

  return {
    title: ours("For your oncologist"),
    intro: ours(
      `A list of trials to ask about, from a search of ClinicalTrials.gov${input.snapshotMonth === undefined ? "" : ` as it stood in ${input.snapshotMonth}`} and a short set of questions. It doesn't say whether any trial suits this person. Their oncologist and each trial's team decide that.`,
    ),
    answersHeading: ours("What they were asked, and answered"),
    answers,
    questionsHeading: ours("Questions that would settle the most of these trials"),
    questions,
    bringHeading: ours("What to bring"),
    bring: [...bringItems].map(([item, qs]) => ({ item: ours(item), answers: qs })),
    trialsHeading: ours("The trials"),
    trials: view.shortlist.map((t) => ({
      nctId: t.nctId,
      title: t.title,
      phase: t.phase,
      site: t.site,
      read: t.read,
      thin: t.thin,
      hints: t.hints,
      other: t.other,
    })),
    closing: ours(
      "None of this says a trial fits. The reading of each trial's rules is automatic, and wrong about a quarter of the time. The oncologist and the trial team decide.",
    ),
  };
}

/**
 * Facts a short-list trial asks about that the person didn't answer, and
 * that the sheet neither asks as a question nor shows as a hint on that
 * trial (spec 0004 §6). Must be empty. Facts never asked of this person
 * don't count.
 */
export function sheetMissing(
  sheet: SheetView,
  shortlist: readonly OrderEntry[],
  skipped: readonly string[] = [],
): { nctId: string; factId: string }[] {
  const asked = new Set(sheet.questions.map((q) => q.factId));
  return shortlist.flatMap((e) => {
    const hinted = new Set(
      sheet.trials.find((t) => t.nctId === e.candidate.nctId)?.hints.map((h) => h.factId) ?? [],
    );
    return (e.status?.unknown ?? [])
      .filter((f) => !skipped.includes(f) && !asked.has(f) && !hinted.has(f))
      .map((factId) => ({ nctId: e.candidate.nctId, factId }));
  });
}
