import { describe, expect, it } from "vitest";
import type { PatientConversation } from "../../evals/check/pairs.js";
import { checkPair } from "../../evals/check/run.js";
import type { Patient } from "../../evals/questions/patients.js";
import { criteriaSha256 } from "../../src/check/parse-cache.js";
import type { ParsedCriteria } from "../../src/criteria/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { FakeModelAdapter } from "../../src/models/index.js";
import type { ConversationSettings } from "../../src/questions/settings.js";
import { ASK_SYSTEM_PROMPT } from "../../src/screening/prompts.js";
import { getTrial } from "../../src/trials/index.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";

/**
 * One pair end to end on fake models: the loop runs until the agent closes,
 * each participant reply is recorded at its transcript index, and a trial
 * with no parse gets the record from its mappings alone.
 */

const vocabulary = loadFactVocabulary();
const pinned = getTrial("NCT04316364");
const TRIAL = {
  ...pinned,
  primaryPurpose: null,
  keywords: [],
  conditionMesh: [],
  conditionAncestors: [],
  interventions: [],
  leadSponsor: "",
  lastUpdatePostDate: "2000-06",
  completionDate: null,
  sites: [],
} as unknown as SnapshotTrial;
const TEXT = TRIAL.eligibility.criteriaText;
const ECOG = "Eastern Cooperative Oncology Group (ECOG) performance status 0 or 1";
const start = TEXT.indexOf(ECOG);

const parsed: ParsedCriteria & { criteriaSha256: string } = {
  nctId: TRIAL.nctId,
  criteria: [
    {
      id: `${TRIAL.nctId}:${start}-${start + ECOG.length}`,
      polarity: "inclusion",
      type: "patient",
      text: "ECOG 0 or 1",
      source: { start, end: start + ECOG.length, text: ECOG },
      confidence: null,
    },
  ],
  rejected: [],
  unclaimed: [],
  run: {
    model: "fake",
    quantization: "none",
    temperature: 0,
    seed: 0,
    adapter: "fake",
    promptVersion: "x",
    timestamp: "2000-06",
  },
  criteriaSha256: criteriaSha256(TEXT),
};

const patient: Patient = {
  id: "p99",
  persona: "made up",
  search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "male" },
  record: { ecog: "ps1" },
  knows: ["ecog"],
  says: { ecog: "Up and about." },
  dontKnowPhrases: ["No idea."],
};
const conversation = {
  patient,
  trials: [],
  result: { steps: [], stop: "budget", profile: {}, order: [], shortlist: [] },
  answers: new Map(),
} as unknown as PatientConversation;
const settings = { order: "other-last" } as unknown as ConversationSettings;
const pick = { patient: "p99", set: "dev" as const, nctId: TRIAL.nctId, rank: 1 };

function models() {
  const agent = new FakeModelAdapter([], {
    respond: (r) =>
      r.system === ASK_SYSTEM_PROMPT
        ? { kind: "json", content: { message: "How active are you day to day?" } }
        : { kind: "json", content: { readings: [] } },
  });
  const participant = new FakeModelAdapter([], {
    respond: (r) =>
      r.system.includes("YOUR FACTS") || r.user.includes("YOUR FACTS")
        ? { kind: "json", content: { message: "Up and about.", usedFacts: ["ecog"] } }
        : { kind: "json", content: { faithful: true, reason: "" } },
  });
  return { agent, participant };
}

describe("checkPair", () => {
  it("runs the check to its close, recording each reply at its transcript index", async () => {
    const { agent, participant } = models();
    const t = await checkPair({
      pick,
      conversation,
      trial: TRIAL,
      facts: undefined,
      parsed,
      vocabulary,
      settings,
      agent,
      participant,
      fidelity: participant,
    });
    expect(t.parse).toBe("parsed");
    expect(t.error).toBeUndefined();
    // Asked twice, as the agent asks an unsettled criterion, then closed.
    expect(t.transcript.filter((x) => x.kind === "question")).toHaveLength(2);
    expect(t.replies.map((r) => r.turn)).toEqual(
      t.transcript.filter((x) => x.speaker === "participant").map((x) => x.index),
    );
    expect(t.replies[0]?.usedFacts).toEqual(["ecog"]);
    expect(t.findings[0]).toMatchObject({ criterionId: "P1", status: "unresolved" });
    expect(t.sources["P1"]).toEqual(parsed.criteria[0]?.source);
    expect(t.orderBefore).toEqual(t.orderAfter);
  });

  it("with no parse, builds the record from the trial's mappings alone", async () => {
    const { agent, participant } = models();
    const t = await checkPair({
      pick,
      conversation,
      trial: TRIAL,
      facts: undefined,
      parsed: undefined,
      vocabulary,
      settings,
      agent,
      participant,
      fidelity: participant,
    });
    expect(t.parse).toBe("missing");
    expect(t.record.lead).not.toBeNull();
    expect(agent.requests).toEqual([]);
  });
});
