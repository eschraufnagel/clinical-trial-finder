import type { CachedParse } from "../../src/check/parse-cache.js";
import { recordWithoutParse } from "../../src/check/record.js";
import { recordOf, startCheck } from "../../src/check/run.js";
import type { SourceSpan } from "../../src/criteria/types.js";
import type { FactVocabulary, TrialFacts } from "../../src/facts/types.js";
import type { ModelAdapter } from "../../src/models/types.js";
import { orderFor } from "../../src/questions/conversation.js";
import type { ConversationSettings } from "../../src/questions/settings.js";
import type { AgentReply } from "../../src/screening/session.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";
import {
  freshMemory,
  patientFidelityCheck,
  patientFlags,
  simulatePatient,
} from "../participant/patient.js";
import type { TranscriptLine } from "../participant/simulate.js";
import type { PairPick, PatientConversation } from "./pairs.js";
import type { PairTranscript, ParticipantTurn } from "./transcript.js";

/**
 * One pair's check, end to end (spec 0007 §7.3): the conversation's answers,
 * the committed parse, the link, the session, the patient participant until
 * the agent closes, and the record. Deterministic but for the models, which
 * are passed in: the agent's, the participant's and the fidelity check's.
 */

/**
 * Moves when the check's own code changes what a transcript holds without
 * moving a prompt: the record's sections, the agent's fallback to a fixed
 * question. It's part of `check:eval`'s run hash, so a revision is a new run,
 * never a mix with transcripts the old code wrote. 1 was dev's first run; 2
 * is after Gate 1's revisions (R1 to R3); 3 is slice 0009's record, which
 * counts and asks about rules for one part of the trial on their own; 4 is
 * slice 0010's, which reads a list the trial accepts any one of as one rule.
 */
export const CHECK_REVISION = 4;

/** Far beyond any trial's criteria twice over; a guard against a loop, never a budget. */
export const MAX_TURNS = 400;

export interface PairInput {
  pick: PairPick;
  conversation: PatientConversation;
  trial: SnapshotTrial;
  facts: TrialFacts | undefined;
  parsed: CachedParse | undefined;
  vocabulary: FactVocabulary;
  settings: ConversationSettings;
  agent: ModelAdapter;
  participant: ModelAdapter;
  fidelity: ModelAdapter;
  onTurn?: (message: string) => void;
}

export async function checkPair(input: PairInput): Promise<PairTranscript> {
  const { pick, conversation, trial, vocabulary } = input;
  const study = { nctId: trial.nctId, briefTitle: trial.briefTitle };
  const ids = (entries: readonly { candidate: { nctId: string } }[]) =>
    entries.map((e) => e.candidate.nctId);
  const orderBefore = ids(conversation.result.order);
  const orderAfter = () =>
    ids(
      orderFor(conversation.trials, conversation.result.profile, vocabulary, input.settings.order),
    );
  const base = {
    patient: pick.patient,
    nctId: pick.nctId,
    set: pick.set,
    rank: pick.rank,
    conversation: Object.fromEntries(conversation.answers),
    orderBefore,
  };

  if (input.parsed === undefined) {
    const mappings = input.facts?.mappings ?? [];
    const sources: Record<string, SourceSpan> = Object.fromEntries(
      mappings.map((m, i) => [`M${i + 1}`, m.source]),
    );
    return {
      ...base,
      parse: "missing",
      criteria: [],
      sources,
      links: {},
      carried: {},
      findings: [],
      transcript: [],
      rejectedReadings: [],
      ignoredReadings: [],
      replies: [],
      record: recordWithoutParse(study, mappings, conversation.answers),
      orderAfter: orderAfter(),
      calls: { agent: 0, participant: 0, fidelity: 0 },
      run: null,
    };
  }

  const check = startCheck({
    study,
    criteriaText: trial.eligibility.criteriaText,
    parsed: input.parsed,
    facts: input.facts,
    answers: conversation.answers,
    adapter: input.agent,
  });
  // `fromParse` numbers criteria P1… in parse order.
  const sources: Record<string, SourceSpan> = Object.fromEntries(
    input.parsed.criteria.map((c, i) => [`P${i + 1}`, c.source]),
  );

  const lines: TranscriptLine[] = [];
  const replies: ParticipantTurn[] = [];
  const calls = { agent: 0, participant: 0, fidelity: 0 };
  let memory = freshMemory();
  let error: string | undefined;
  let reply: AgentReply | undefined;

  try {
    reply = await check.session.start();
    lines.push({ speaker: "agent", text: reply.text });
    while (reply.kind !== "done") {
      if (lines.length > MAX_TURNS) throw new Error(`more than ${MAX_TURNS} turns`);
      const said = await simulatePatient(
        conversation.patient,
        vocabulary,
        lines,
        memory,
        input.participant,
      );
      calls.participant += 1;
      memory = said.memory;
      const flags = patientFlags(conversation.patient, vocabulary, said.message, said.usedFacts);
      const model = await patientFidelityCheck(
        conversation.patient,
        vocabulary,
        said.message,
        input.fidelity,
      );
      calls.fidelity += 1;
      replies.push({
        turn: check.session.state().transcript.length,
        usedFacts: said.usedFacts,
        flags: model === null ? flags : [...flags, model],
      });
      lines.push({ speaker: "participant", text: said.message });
      input.onTurn?.(said.message);
      reply = await check.session.receive(said.message);
      lines.push({ speaker: "agent", text: reply.text });
    }
  } catch (e) {
    // The whole reason, up to a few lines: the first line of a model error only says which call.
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
    links: Object.fromEntries(check.links),
    carried: check.carried,
    findings: result.findings,
    transcript: result.transcript,
    rejectedReadings: result.rejectedReadings,
    ignoredReadings: result.ignoredReadings,
    replies,
    record: recordOf(check, result),
    orderAfter: orderAfter(),
    calls,
    run: result.run,
    ...(error === undefined ? {} : { error }),
  };
}
