import type { CachedParse } from "../../src/check/parse-cache.js";
import { recordWithoutParse, type TrialRecord } from "../../src/check/record.js";
import { recordOf, startCheck } from "../../src/check/run.js";
import type { ParseableTrial } from "../../src/criteria/prompt.js";
import type { SourceSpan } from "../../src/criteria/types.js";
import type { ModelAdapter, ModelRunMetadata } from "../../src/models/types.js";
import type { AgentReply } from "../../src/screening/session.js";
import type {
  Finding,
  IgnoredReading,
  RejectedReading,
  ScreeningCriterion,
  Turn,
} from "../../src/screening/types.js";
import { MAX_TURNS } from "../check/run.js";
import type { FidelityFlag } from "../participant/fidelity.js";
import type { TranscriptLine } from "../participant/simulate.js";
import { simulateFromSummary, summaryFidelityCheck, summaryFlags } from "../participant/summary.js";
import type { BenchmarkPair } from "./pairs.js";

/**
 * One NIH-TrialBench pair's deeper check, in one arm (spec 0008 §7.6): the
 * committed parse, `startCheck` with nothing carried (the inherited path), the
 * summary participant answering from the arm's text until the agent closes,
 * and the record. Everything it produced is kept as plain JSON, one file per
 * pair and arm, so a result regrades with no model.
 */

/** "full": the vignette's summary. "account": the patient's account of it, by KNOWING.md. */
export type Arm = "full" | "account";

export interface SummaryTurn {
  /** Transcript index of the participant's reply. */
  turn: number;
  quotes: string[];
  flags: FidelityFlag[];
}

export interface BenchmarkTranscript extends BenchmarkPair {
  arm: Arm;
  /** "parsed" when the check ran; "failed" when the trial has no parse. */
  parse: "parsed" | "failed";
  criteria: ScreeningCriterion[];
  /** Each criterion's passage in the trial's text, by id (P1…). */
  sources: Record<string, SourceSpan>;
  findings: Finding[];
  transcript: Turn[];
  rejectedReadings: RejectedReading[];
  ignoredReadings: IgnoredReading[];
  replies: SummaryTurn[];
  record: TrialRecord;
  calls: { agent: number; participant: number; fidelity: number };
  run: ModelRunMetadata | null;
  /** Why the check stopped early, when it did. */
  error?: string;
}

export interface BenchmarkPairInput {
  pair: BenchmarkPair;
  arm: Arm;
  /** The arm's text: the summary or the account. */
  text: string;
  trial: ParseableTrial;
  parsed: CachedParse | undefined;
  agent: ModelAdapter;
  participant: ModelAdapter;
  fidelity: ModelAdapter;
  onTurn?: (message: string) => void;
}

export async function checkBenchmarkPair(input: BenchmarkPairInput): Promise<BenchmarkTranscript> {
  const { pair, arm, trial } = input;
  const study = { nctId: trial.nctId, briefTitle: trial.briefTitle };
  const base = { ...pair, arm };

  if (input.parsed === undefined) {
    return {
      ...base,
      parse: "failed",
      criteria: [],
      sources: {},
      findings: [],
      transcript: [],
      rejectedReadings: [],
      ignoredReadings: [],
      replies: [],
      record: recordWithoutParse(study, [], new Map()),
      calls: { agent: 0, participant: 0, fidelity: 0 },
      run: null,
    };
  }

  const check = startCheck({
    study,
    criteriaText: trial.eligibility.criteriaText,
    parsed: input.parsed,
    facts: undefined,
    answers: new Map(),
    adapter: input.agent,
  });
  const sources: Record<string, SourceSpan> = Object.fromEntries(
    input.parsed.criteria.map((c, i) => [`P${i + 1}`, c.source]),
  );

  const lines: TranscriptLine[] = [];
  const replies: SummaryTurn[] = [];
  const calls = { agent: 0, participant: 0, fidelity: 0 };
  let error: string | undefined;
  let reply: AgentReply | undefined;

  try {
    reply = await check.session.start();
    lines.push({ speaker: "agent", text: reply.text });
    while (reply.kind !== "done") {
      if (lines.length > MAX_TURNS) throw new Error(`more than ${MAX_TURNS} turns`);
      const said = await simulateFromSummary(input.text, lines, input.participant);
      calls.participant += 1;
      const flags = summaryFlags(input.text, said);
      const model = await summaryFidelityCheck(input.text, said.message, input.fidelity);
      calls.fidelity += 1;
      replies.push({
        turn: check.session.state().transcript.length,
        quotes: said.quotes,
        flags: model === null ? flags : [...flags, model],
      });
      lines.push({ speaker: "participant", text: said.message });
      input.onTurn?.(said.message);
      reply = await check.session.receive(said.message);
      lines.push({ speaker: "agent", text: reply.text });
    }
  } catch (e) {
    error = (e instanceof Error ? e.message : String(e)).slice(0, 600);
  }

  const state = check.session.state();
  calls.agent = state.calls;
  // A check that stopped early is closed where it stood, as the page's "stop" does.
  const result = reply?.kind === "done" ? reply.result : check.session.stop();
  return {
    ...base,
    parse: "parsed",
    criteria: check.criteria,
    sources,
    findings: result.findings,
    transcript: result.transcript,
    rejectedReadings: result.rejectedReadings,
    ignoredReadings: result.ignoredReadings,
    replies,
    record: recordOf(check, result),
    calls,
    run: result.run,
    ...(error === undefined ? {} : { error }),
  };
}
