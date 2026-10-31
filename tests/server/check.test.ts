import { describe, expect, it } from "vitest";
import { NO_PARSE } from "../../src/check/record.js";
import { parseCriteria } from "../../src/criteria/parse.js";
import {
  type CompletionRequest,
  FakeModelAdapter,
  ModelError,
  type ScriptedResponse,
} from "../../src/models/index.js";
import { ASK_SYSTEM_PROMPT } from "../../src/screening/prompts.js";
import { CHECK_WORDS, type CheckOptions, CheckService, TAPS } from "../../src/server/check.js";
import { CONFIRM, FinderService, type ReaderSource } from "../../src/server/finder.js";
import { verdictHits } from "../../src/shortlist/words.js";
import { MemoryTransport, routeByConversation } from "../../src/transport/index.js";
import {
  CONTRACEPTION,
  checkOptions,
  ECOG,
  FORM,
  finderOptions,
  parser,
  settle,
} from "./fixture.js";

/**
 * The check service over the memory transport, sharing it with the
 * conversation through the router, as the app does, on the fixture's check
 * data (`checkOptions`). Answering the conversation's first question carries
 * the ECOG rule, so the check asks only about contraception.
 */

interface Agent {
  ask?: () => ScriptedResponse;
  read?: (request: CompletionRequest) => ScriptedResponse;
}

/** A reader whose adapter answers the agent's two calls as told, and counts releases. */
function agentReader(agent: Agent = {}): ReaderSource & { released: number } {
  const reader = {
    released: 0,
    current: () => "scripted",
    name: () => "a scripted reader",
    measured: () => false,
    forConversation: () =>
      new FakeModelAdapter([], {
        respond: (request) =>
          request.system === ASK_SYSTEM_PROMPT
            ? (agent.ask?.() ?? { kind: "json", content: { message: "Do you agree to it?" } })
            : (agent.read?.(request) ?? { kind: "json", content: { readings: [] } }),
      }),
    release: () => {
      reader.released++;
    },
  };
  return reader;
}

const failing = (): ScriptedResponse => {
  throw new ModelError("Cannot reach the model", ["connection refused"]);
};

function setUp(
  options: Partial<Omit<CheckOptions, "transport" | "finder">> = {},
  reader: ReaderSource = agentReader(),
) {
  const transport = new MemoryTransport();
  const route = routeByConversation(transport);
  const finder = new FinderService({ ...finderOptions(reader), transport: route() });
  const started = finder.start(FORM);
  if (!started.ok) throw new Error(started.error);
  const finderId = started.id;
  transport.choose(finderId, "none");
  finder.stop(finderId);
  let n = 0;
  const check = new CheckService({
    transport: route(),
    reader,
    finder,
    ...checkOptions(),
    newId: () => `k${++n}`,
    ...options,
  });
  const begin = async (nctIds: string[]) => {
    const outcome = check.start({ finderId, nctIds });
    if (!outcome.ok) throw new Error(outcome.error);
    await settle();
    return outcome.id;
  };
  const last = (id: string) => transport.view(id)?.messages.at(-1);
  return { transport, finder, finderId, check, begin, last };
}

describe("starting a check", () => {
  it("reads the trial's rules, then asks only what the conversation didn't cover, with taps", async () => {
    const { transport, begin, last } = setUp();
    const id = await begin(["NCT01"]);
    const said = transport.delivered(id);
    expect(said[0]).toBe(CHECK_WORDS.reading("Trial NCT01"));
    expect(said[1]).toMatch(/covered 1 of its rules/);
    expect(said[1]).toMatch(/Agrees to use contraception/);
    expect(last(id)?.choices).toEqual(TAPS);
    expect(transport.view(id)?.status).toBe("idle");
  });

  it("refuses a fourth trial, a trial off the list, a repeat, and an unknown conversation", () => {
    const { check, finderId } = setUp();
    const refused = (nctIds: unknown, id: unknown = finderId) =>
      check.start({ finderId: id, nctIds });
    expect(refused(["NCT01", "NCT02", "NCT03", "NCT04"])).toMatchObject({ ok: false, code: 400 });
    expect(refused([])).toMatchObject({ ok: false, code: 400 });
    expect(refused(["NCT01", "NCT01"])).toMatchObject({ ok: false, code: 400 });
    expect(refused(["NCT99"])).toMatchObject({ ok: false, error: "not-checkable" });
    expect(refused(["NCT01"], "nobody")).toMatchObject({ ok: false, code: 404 });
  });

  it("offers only the trials it can check", () => {
    const { check, finderId } = setUp({ checkable: (id) => id === "NCT02" });
    expect(check.checkable(finderId)).toEqual(["NCT02"]);
    expect(check.start({ finderId, nctIds: ["NCT01"] })).toMatchObject({ error: "not-checkable" });
    expect(check.checkable("nobody")).toBeUndefined();
  });
});

describe("taps", () => {
  it("are applied with no model, and the record files the answer and the carried rule", async () => {
    const { transport, check, begin } = setUp();
    const id = await begin(["NCT01"]);
    transport.choose(id, "yes");
    await settle();
    const said = transport.delivered(id);
    expect(said.at(-2)).toMatch(/Your record for this trial is ready/);
    expect(said.at(-1)).toBe(CHECK_WORDS.allDone);
    expect(transport.view(id)?.status).toBe("done");

    const view = check.view(id);
    expect(view?.done).toBe(true);
    const record = view?.records[0];
    expect(record?.earlier.lines).toEqual([
      expect.objectContaining({
        rule: { registry: ECOG },
        earlier: [expect.objectContaining({ said: { said: "No" } })],
      }),
    ]);
    expect(record?.told.lines).toEqual([
      expect.objectContaining({ rule: { registry: CONTRACEPTION }, said: [{ said: "Yes" }] }),
    ]);
  });

  it("check each trial in turn", async () => {
    const { transport, check, begin } = setUp();
    const id = await begin(["NCT01", "NCT02"]);
    transport.choose(id, "no");
    await settle();
    expect(check.view(id)?.current).toBe(1);
    expect(transport.delivered(id)).toContain(CHECK_WORDS.reading("Trial NCT02"));
    transport.choose(id, "unknown");
    await settle();
    const view = check.view(id);
    expect(view?.done).toBe(true);
    expect(view?.records[0]?.told.lines[0]?.mayNotFit).toBe(true);
    expect(view?.records[1]?.records.lines[0]?.why).toEqual({ ours: "You didn't know." });
  });
});

describe("typed replies", () => {
  const reading = (reading: string) => ({
    read: (): ScriptedResponse => ({
      kind: "json",
      content: {
        readings: [
          {
            criterionId: "P2",
            reading,
            quote: "I always do",
            statement: "Uses it",
            outright: true,
          },
        ],
      },
    }),
  });

  it("are read and shown back; nothing counts until confirmed", async () => {
    const { transport, check, begin, last } = setUp(
      { fixedQuestions: false },
      agentReader(reading("holds")),
    );
    const id = await begin(["NCT01"]);
    expect(transport.delivered(id).at(-1)).toMatch(/Do you agree to it\?$/);
    transport.send(id, "I always do");
    await settle();
    expect(last(id)).toMatchObject({
      text: `${CHECK_WORDS.readAs}\n${CHECK_WORDS.readLine("Agrees to use contraception", "yes")}`,
      choices: CONFIRM,
    });
    expect(check.view(id)?.records[0]).toBeNull();

    transport.choose(id, "confirm");
    await settle();
    expect(check.view(id)?.records[0]?.told.lines[0]).toMatchObject({
      said: [{ said: "I always do" }],
      mayNotFit: false,
    });
  });

  it("change discards the readings and offers the taps", async () => {
    const { transport, check, begin, last } = setUp({}, agentReader(reading("does-not-hold")));
    const id = await begin(["NCT01"]);
    transport.send(id, "I always do");
    await settle();
    transport.choose(id, "change");
    await settle();
    expect(last(id)).toMatchObject({ text: CHECK_WORDS.choose, choices: TAPS });
    transport.choose(id, "yes");
    await settle();
    expect(check.view(id)?.records[0]?.told.lines[0]?.said).toEqual([{ said: "Yes" }]);
  });

  it("fall back to the taps when the model can't be reached, saying why", async () => {
    const { transport, begin, last } = setUp({}, agentReader({ read: failing }));
    const id = await begin(["NCT01"]);
    transport.send(id, "I always do");
    await settle();
    expect(last(id)).toMatchObject({
      text: CHECK_WORDS.unavailableBecause("connection refused."),
      choices: TAPS,
    });
  });

  it("aren't read where there's no model to read them", async () => {
    const { transport, begin, last } = setUp({ readTyped: false });
    const id = await begin(["NCT01"]);
    transport.send(id, "I always do");
    await settle();
    expect(last(id)).toMatchObject({ text: CHECK_WORDS.tapsOnly, choices: TAPS });
  });
});

describe("when the model fails to word a question", () => {
  it("asks the rule in the trial's own words, and says so", async () => {
    const { transport, begin } = setUp({ fixedQuestions: false }, agentReader({ ask: failing }));
    const id = await begin(["NCT01"]);
    const said = transport.delivered(id);
    expect(said).toContain(CHECK_WORDS.ownWords);
    expect(said.at(-1)).toMatch(/The trial asks about this: “Agrees to use contraception”/);
  });
});

describe("stopping", () => {
  it("a tap on Stop files the trial's record as it stands, and goes on", async () => {
    const { transport, check, begin } = setUp();
    const id = await begin(["NCT01", "NCT02"]);
    transport.choose(id, "stop");
    await settle();
    expect(transport.delivered(id)).toContain(CHECK_WORDS.stoppedTrial);
    expect(check.view(id)?.records[0]?.records.lines[0]?.why).toEqual({ ours: "Not asked." });
    expect(check.view(id)?.current).toBe(1);
  });

  it("stop ends the check: the trial in hand gets its record, the rest none", async () => {
    const { transport, check, begin } = setUp();
    const id = await begin(["NCT01", "NCT02"]);
    expect(check.stop(id)).toBe(true);
    const view = check.view(id);
    expect(view?.done).toBe(true);
    expect(view?.records[0]).not.toBeNull();
    expect(view?.records[1]).toBeNull();
    expect(transport.delivered(id).at(-1)).toBe(CHECK_WORDS.stoppedAll);
    expect(check.remove(id)).toBe(true);
    expect(transport.view(id)).toBeUndefined();
  });
});

describe("a trial whose rules can't be read", () => {
  it("gets the record the mappings and answers allow, and the check goes on", async () => {
    const { transport, check, begin } = setUp({
      parse: (trial) =>
        trial.nctId === "NCT01"
          ? Promise.reject(new Error("unreadable"))
          : parseCriteria(trial, parser()),
    });
    const id = await begin(["NCT01", "NCT02"]);
    expect(transport.delivered(id)).toContain(CHECK_WORDS.noParse);
    const record = check.view(id)?.records[0];
    expect(record?.lead).toEqual({ ours: NO_PARSE });
    expect(record?.earlier.lines[0]?.rule).toEqual({ registry: ECOG });
    expect(check.view(id)?.current).toBe(1);
  });

  it("says so when the cost cap stopped the parse", async () => {
    const { transport, begin } = setUp({
      parse: () => Promise.reject(new ModelError("Stopped", ["budget: the cap is reached"])),
    });
    const id = await begin(["NCT01"]);
    expect(transport.delivered(id)).toContain(CHECK_WORDS.parseCapped);
    expect(transport.view(id)?.status).toBe("done");
  });
});

describe("the conversation", () => {
  it("is unchanged by a check: same order, same answers", async () => {
    const { transport, finder, finderId, begin } = setUp();
    const before = finder.view(finderId);
    const id = await begin(["NCT01"]);
    transport.choose(id, "no");
    await settle();
    expect(finder.view(finderId)).toEqual(before);
    expect(transport.view(finderId)?.messages.length).toBeGreaterThan(0);
  });

  it("releases each trial's adapter, so what it spent is logged", async () => {
    const reader = agentReader();
    const { transport, begin } = setUp({}, reader);
    const before = reader.released;
    const id = await begin(["NCT01"]);
    transport.choose(id, "yes");
    await settle();
    expect(reader.released).toBeGreaterThan(before);
  });
});

describe("the check's own words", () => {
  it("say nothing that sounds like a verdict", () => {
    const words = Object.values(CHECK_WORDS).map((w) =>
      typeof w === "function" ? w("x", "y") : w,
    );
    expect(verdictHits([...words, ...TAPS.map((t) => t.label)])).toEqual([]);
  });
});
