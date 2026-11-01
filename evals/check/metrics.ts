import { LINK_THRESHOLD, overlap } from "../../src/check/link.js";
import type { RecordLine, TrialRecord } from "../../src/check/record.js";
import { FIXED_QUESTION_TEMPLATE, fixedQuestion } from "../../src/screening/templates.js";
import { oursIn, verdictHits } from "../../src/shortlist/words.js";
import { wilson } from "../search/metrics.js";
import type { PairLabel } from "./pairs.js";
import type { PairTranscript } from "./transcript.js";

/**
 * Scores one pair's check against its label (spec 0007 §7.4). Pure, so a
 * committed result regrades from its transcripts.
 *
 * - **Saved:** raisable criteria the conversation's answers closed. The agent
 *   asks every open raisable criterion at least once and never stops early,
 *   so each is one question not asked.
 * - **A repeat:** an agent question whose reply, by the participant's own
 *   report, drew on a fact the conversation already asked.
 * - **Caught:** a pair labelled clearly ruled out whose record shows the
 *   labelled rule as "may not fit". The rule is matched to criteria by the
 *   link's overlap rule.
 * - **Caught, of the knowable:** the same, among ruled-out pairs whose
 *   deciding facts (the label's `facts`) the patient knows, from the patient's
 *   file. A rule that turns on a biomarker the patient can't report can't be
 *   caught by talking to them; at best it reaches the oncologist's list, and
 *   is missed as "unknown-or-records".
 * - **A false alarm:** any "may not fit" on a pair labelled not clearly ruled
 *   out. Not an error in itself (the label is only "not clearly"), but the
 *   cost the person pays in worry, so every one is listed.
 *
 * A record line whose "may not fit" rests on a participant reply flagged as
 * unfaithful is excluded from caught and false alarms, and counted: the
 * simulator's invention isn't the check's finding.
 */

export type MissReason =
  | "not-parsed"
  | "about-the-trial"
  | "unknown-or-records"
  | "no-conflict"
  | "unfaithful"
  | "check-failed";

export interface PairRow {
  patient: string;
  nctId: string;
  set: string;
  parse: "parsed" | "missing";
  raisable: number;
  saved: number;
  asked: number;
  repeats: { turn: number; facts: string[] }[];
  clearlyRuledOut: boolean;
  /** When clearly ruled out: whether the patient knows every fact the label turns on. Null otherwise. */
  knowable: boolean | null;
  caught: { route: "carried" | "asked"; criterionId: string } | null;
  missed: MissReason | null;
  falseAlarms: string[];
  verdictHits: string[];
  unknownsMissing: string[];
  orderMoved: boolean;
  flags: number;
  excluded: string[];
  error: string | null;
}

const RAISABLE_STATUSES = new Set([
  "holds",
  "does-not-hold",
  "unresolved",
  "chart-review",
  "from-conversation",
]);

function linesOf(record: TrialRecord): Array<{ section: string; line: RecordLine }> {
  return (["earlier", "told", "records", "aboutTrial"] as const).flatMap((section) =>
    record[section].lines.map((line) => ({ section, line })),
  );
}

/** The parts of a check's transcript the never-a-verdict and every-unknown checks read. */
type Checked = Pick<PairTranscript, "transcript" | "criteria" | "record" | "findings">;

/**
 * Verdict words in the agent's turns and the record. A fixed question quotes
 * the trial's own words, which aren't ours to scan (`src/shortlist/words.ts`),
 * so only its template is. Shared with slice 0008's benchmark.
 */
export function verdictHitsOf(t: Checked): string[] {
  const criteria = new Map(t.criteria.map((c) => [c.id, c]));
  const agentText = t.transcript
    .filter((x) => x.speaker === "agent")
    .map((x) => {
      const c = x.criterionId === undefined ? undefined : criteria.get(x.criterionId);
      return c !== undefined && x.text === fixedQuestion(c) ? FIXED_QUESTION_TEMPLATE : x.text;
    });
  return verdictHits([...agentText, ...oursIn(t.record)]);
}

/** Criteria left open (unresolved, chart review, or a carried "I don't know") that the record doesn't list. */
export function unknownsMissingOf(t: Checked): string[] {
  const onRecord = new Set(
    [...t.record.records.lines, ...t.record.earlier.lines].map((l) => l.criterionId),
  );
  return t.findings
    .filter(
      (f) =>
        f.status === "unresolved" ||
        f.status === "chart-review" ||
        (f.status === "from-conversation" && (f.earlier ?? []).some((e) => e.answer === "unknown")),
    )
    .map((f) => f.criterionId)
    .filter((id) => !onRecord.has(id));
}

/** `knows` is the patient's known facts, from their file. */
export function scorePair(
  t: PairTranscript,
  label: PairLabel,
  criteriaText: string,
  knows: ReadonlySet<string>,
): PairRow {
  const unfaithful = new Set(t.replies.filter((r) => r.flags.length > 0).map((r) => r.turn));
  const excluded = t.findings
    .filter((f) => f.evidence.some((e) => unfaithful.has(e.turn)))
    .map((f) => f.criterionId);
  const lines = linesOf(t.record);
  const counted = lines.filter((l) => !excluded.includes(l.line.criterionId));

  // Raisable: everything the agent could ask, the carried included. A lab
  // value or a rule about the trial is never asked, so never saved.
  const raisable = t.findings.filter((f) => RAISABLE_STATUSES.has(f.status)).length;
  const saved = t.findings.filter((f) => f.status === "from-conversation").length;
  const questions = t.transcript.filter((x) => x.kind === "question");
  const asked = new Set(Object.keys(t.conversation));
  const repeats = questions.flatMap((q) => {
    const reply = t.replies.find((r) => r.turn === q.index + 1);
    const facts = (reply?.usedFacts ?? []).filter((f) => asked.has(f));
    return facts.length > 0 ? [{ turn: q.index, facts }] : [];
  });

  // A rule the conversation's "I don't know" covered is open, not "no conflict".
  const didntKnow = (id: string) =>
    t.findings.some(
      (f) => f.criterionId === id && (f.earlier ?? []).some((e) => e.answer === "unknown"),
    );
  let caught: PairRow["caught"] = null;
  let missed: MissReason | null = null;
  if (label.clearlyRuledOut && label.rule !== undefined) {
    const start = criteriaText.indexOf(label.rule.quote);
    const span = { start, end: start + label.rule.quote.length, text: label.rule.quote };
    const matching = lines.filter((l) => {
      const source = t.sources[l.line.criterionId];
      return source !== undefined && start >= 0 && overlap(source, span) >= LINK_THRESHOLD;
    });
    const hit = matching.find((l) => l.line.mayNotFit && !excluded.includes(l.line.criterionId));
    if (hit !== undefined) {
      caught = {
        route: hit.section === "earlier" ? "carried" : "asked",
        criterionId: hit.line.criterionId,
      };
    } else if (t.error !== undefined && t.parse === "parsed" && matching.length === 0) {
      missed = "check-failed";
    } else if (matching.length === 0) {
      missed = "not-parsed";
    } else if (matching.some((l) => l.line.mayNotFit)) {
      missed = "unfaithful";
    } else if (matching.every((l) => l.section === "aboutTrial")) {
      missed = "about-the-trial";
    } else if (
      matching.some(
        (l) =>
          l.section === "records" || (l.section === "earlier" && didntKnow(l.line.criterionId)),
      )
    ) {
      missed = "unknown-or-records";
    } else {
      missed = "no-conflict";
    }
  }
  const falseAlarms = label.clearlyRuledOut
    ? []
    : counted.filter((l) => l.line.mayNotFit).map((l) => l.line.criterionId);

  return {
    patient: t.patient,
    nctId: t.nctId,
    set: t.set,
    parse: t.parse,
    raisable,
    saved,
    asked: questions.length,
    repeats,
    clearlyRuledOut: label.clearlyRuledOut,
    knowable: label.clearlyRuledOut ? (label.rule?.facts ?? []).every((f) => knows.has(f)) : null,
    caught,
    missed,
    falseAlarms,
    verdictHits: verdictHitsOf(t),
    unknownsMissing: unknownsMissingOf(t),
    orderMoved: t.orderBefore.join(" ") !== t.orderAfter.join(" "),
    flags: t.replies.reduce((n, r) => n + r.flags.length, 0),
    excluded,
    error: t.error ?? null,
  };
}

export interface CheckSummary {
  pairs: number;
  parsed: number;
  saved: number;
  raisable: number;
  savedShare: number;
  asked: number;
  repeats: number;
  ruledOut: number;
  caught: number;
  caughtInterval: [number, number];
  caughtBy: { carried: number; asked: number };
  /** Ruled-out pairs whose deciding facts the patient knows, and how many of those were caught. */
  knowable: number;
  caughtKnowable: number;
  caughtKnowableInterval: [number, number];
  missedBy: Partial<Record<MissReason, number>>;
  notRuledOut: number;
  falseAlarmPairs: number;
  falseAlarmInterval: [number, number];
  verdictHits: number;
  unknownsMissing: number;
  ordersMoved: number;
  flags: number;
  excluded: number;
  errors: number;
}

export function summarize(rows: readonly PairRow[]): CheckSummary {
  const sum = (f: (r: PairRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const ruledOut = rows.filter((r) => r.clearlyRuledOut);
  const notRuledOut = rows.filter((r) => !r.clearlyRuledOut);
  const caught = ruledOut.filter((r) => r.caught !== null);
  const knowable = ruledOut.filter((r) => r.knowable === true);
  const caughtKnowable = knowable.filter((r) => r.caught !== null).length;
  const falseAlarmPairs = notRuledOut.filter((r) => r.falseAlarms.length > 0).length;
  const missedBy: Partial<Record<MissReason, number>> = {};
  for (const r of ruledOut)
    if (r.missed !== null) missedBy[r.missed] = (missedBy[r.missed] ?? 0) + 1;
  const saved = sum((r) => r.saved);
  const raisable = sum((r) => r.raisable);
  return {
    pairs: rows.length,
    parsed: rows.filter((r) => r.parse === "parsed").length,
    saved,
    raisable,
    savedShare: raisable === 0 ? 0 : Math.round((saved / raisable) * 10_000) / 10_000,
    asked: sum((r) => r.asked),
    repeats: sum((r) => r.repeats.length),
    ruledOut: ruledOut.length,
    caught: caught.length,
    caughtInterval: wilson(caught.length, ruledOut.length),
    caughtBy: {
      carried: caught.filter((r) => r.caught?.route === "carried").length,
      asked: caught.filter((r) => r.caught?.route === "asked").length,
    },
    knowable: knowable.length,
    caughtKnowable,
    caughtKnowableInterval: wilson(caughtKnowable, knowable.length),
    missedBy,
    notRuledOut: notRuledOut.length,
    falseAlarmPairs,
    falseAlarmInterval: wilson(falseAlarmPairs, notRuledOut.length),
    verdictHits: sum((r) => r.verdictHits.length),
    unknownsMissing: sum((r) => r.unknownsMissing.length),
    ordersMoved: rows.filter((r) => r.orderMoved).length,
    flags: sum((r) => r.flags),
    excluded: sum((r) => r.excluded.length),
    errors: rows.filter((r) => r.error !== null).length,
  };
}
