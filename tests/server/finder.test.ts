import { describe, expect, it } from "vitest";
import { runConversation } from "../../src/questions/conversation.js";
import { UNKNOWN } from "../../src/questions/select.js";
import { CONFIRM, FinderService, WORDS } from "../../src/server/finder.js";
import { MemoryTransport } from "../../src/transport/index.js";
import { SETTINGS, trials, vocabulary } from "../questions/fixture.js";
import {
  FORM,
  finderOptions,
  NO_SUCH_ZIP,
  type ScriptedReader,
  scriptedReader,
  settle,
} from "./fixture.js";

/**
 * The conversation service on the fixture, over the memory transport. The
 * fixture asks brain metastases first (the intake), then the chooser's
 * follow-ups: hiv, then pregnancy.
 */
function started(reader: ScriptedReader = scriptedReader()) {
  const transport = new MemoryTransport();
  const finder = new FinderService({ ...finderOptions(reader), transport });
  const outcome = finder.start(FORM);
  if (!outcome.ok) throw new Error(outcome.error);
  const id = outcome.id;
  const last = () => transport.view(id)?.messages.at(-1);
  return { transport, finder, id, last, reader };
}

const question = (factId: string) => vocabulary.facts.find((f) => f.id === factId)?.question;

describe("starting", () => {
  it("opens with the intro and the first question, its answers and I don't know as choices", () => {
    const { transport, id, last } = started();
    expect(transport.delivered(id)).toEqual([WORDS.intro, question("brain_mets")]);
    expect(last()?.choices?.map((c) => c.id)).toEqual([
      "none",
      "treated_stable",
      "not_stable_no_symptoms",
      "symptoms",
      UNKNOWN,
    ]);
    expect(transport.view(id)?.status).toBe("idle");
  });

  it("refuses a search form field by field, and a ZIP the gazetteer lacks", () => {
    const finder = new FinderService({ ...finderOptions(), transport: new MemoryTransport() });
    expect(finder.start({ ...FORM, zip: "606" })).toMatchObject({ ok: false, field: "zip" });
    expect(finder.start({ ...FORM, radiusMiles: 30 })).toMatchObject({ field: "radiusMiles" });
    expect(finder.start({ ...FORM, age: 60.5 })).toMatchObject({ field: "age" });
    expect(finder.start({ ...FORM, sex: "other" })).toMatchObject({ field: "sex" });
    expect(finder.start({ ...FORM, zip: NO_SUCH_ZIP })).toMatchObject({
      ok: false,
      field: "zip",
      error: expect.stringMatching(/isn't in the Census Bureau's ZIP table/),
    });
    expect(finder.start({ ...FORM, radiusMiles: null }).ok).toBe(true);
  });
});

describe("a typed reply", () => {
  const reader = () =>
    scriptedReader({ "The scans were clear.": { kind: "json", content: { answer: "none" } } });

  it("is read, and shown back to confirm: nothing is answered until it is", async () => {
    const { transport, finder, id, last } = started(reader());
    transport.send(id, "The scans were clear.");
    await settle();
    expect(last()).toMatchObject({
      text: WORDS.readAs("No"),
      choices: CONFIRM,
    });
    expect(finder.view(id)?.answers).toEqual([]);

    transport.choose(id, "confirm");
    await settle();
    expect(finder.view(id)?.answers).toEqual([
      expect.objectContaining({
        factId: "brain_mets",
        answer: "none",
        said: "The scans were clear.",
      }),
    ]);
    expect(last()?.text).toBe(question("hiv"));
  });

  it("can be changed: Change it offers the answers, and a choice is taken as given", async () => {
    const { transport, finder, id, last } = started(reader());
    transport.send(id, "The scans were clear.");
    await settle();
    transport.choose(id, "change");
    await settle();
    expect(last()?.text).toBe(WORDS.closest);
    expect(last()?.choices?.map((c) => c.id)).toContain("treated_stable");
    transport.choose(id, "treated_stable");
    await settle();
    expect(finder.view(id)?.answers[0]).toMatchObject({ answer: "treated_stable", said: null });
  });

  it("read as I don't know is confirmed too, and answers nothing", async () => {
    const { transport, finder, id, last } = started();
    transport.send(id, "No idea, honestly.");
    await settle();
    expect(last()).toMatchObject({ text: WORDS.readUnknown, choices: CONFIRM });
    transport.choose(id, "confirm");
    await settle();
    expect(finder.view(id)?.answers[0]).toMatchObject({
      answer: UNKNOWN,
      said: "No idea, honestly.",
    });
  });

  it("typed again instead of confirming is read again, and the first reading is dropped", async () => {
    const { transport, finder, id, last } = started(reader());
    transport.send(id, "Not sure.");
    await settle();
    transport.send(id, "The scans were clear.");
    await settle();
    expect(last()?.text).toBe(WORDS.readAs("No"));
    transport.choose(id, "confirm");
    await settle();
    expect(finder.view(id)?.answers[0]).toMatchObject({ answer: "none" });
  });
});

describe("falling back to the answers", () => {
  it("when the reading names an answer the question doesn't have", async () => {
    const r = scriptedReader({ ps1: { kind: "json", content: { answer: "ps1" } } });
    const { transport, finder, id, last } = started(r);
    transport.send(id, "ps1");
    await settle();
    expect(last()?.text).toBe(WORDS.unclear);
    expect(last()?.choices?.at(-1)?.id).toBe(UNKNOWN);
    expect(finder.view(id)?.answers).toEqual([]);
  });

  it("when the model fails, saying why", async () => {
    const r = scriptedReader({ down: { kind: "error", message: "connection refused" } });
    const { transport, id, last } = started(r);
    transport.send(id, "down");
    await settle();
    expect(last()?.text).toBe(
      "I couldn't read that just now: connection refused. Which is closest?",
    );
    expect(transport.view(id)?.status).toBe("idle");
  });

  it("when the conversation has reached its cost cap", async () => {
    const r = scriptedReader({ capped: { kind: "error", message: "budget: $0.10 reached" } });
    const { transport, id, last } = started(r);
    transport.send(id, "capped");
    await settle();
    expect(last()?.text).toBe(WORDS.capped);
  });

  it("when no model could be built, saying why", async () => {
    const { transport, id, last } = started(
      scriptedReader({}, { unbuildable: "No key saved for Anthropic. Add one in Settings." }),
    );
    transport.send(id, "No.");
    await settle();
    expect(last()?.text).toBe(
      "I couldn't read that just now: No key saved for Anthropic. Add one in Settings. Which is closest?",
    );
    expect(last()?.choices?.length).toBeGreaterThan(1);
  });
});

describe("choices", () => {
  it("answer at once, with no confirm, and no words are recorded", async () => {
    const { transport, finder, id, last } = started();
    transport.choose(id, "none");
    await settle();
    expect(finder.view(id)?.answers[0]).toMatchObject({
      factId: "brain_mets",
      answer: "none",
      said: null,
    });
    expect(last()?.text).toBe(question("hiv"));
  });

  it("left over from an earlier question are refused", async () => {
    const { transport, id } = started();
    transport.choose(id, "none");
    await settle();
    expect(transport.choose(id, "treated_stable")).toMatchObject({ reason: "not-a-choice" });
  });
});

describe("stopping, changing and starting over", () => {
  it("stops at the person's request: the closing message, done, and the list as it stands", async () => {
    const { transport, finder, id, last, reader } = started();
    transport.choose(id, "none");
    await settle();
    expect(finder.stop(id)).toBe(true);
    expect(last()?.text).toBe(WORDS.stopped);
    expect(transport.view(id)?.status).toBe("done");
    expect(finder.view(id)?.stopped).toBe(true);
    expect(reader.released).toBe(1);
  });

  it("changes a confirmed answer from the fixed answers: the list reorders, no question follows", async () => {
    const { transport, finder, id } = started();
    transport.choose(id, "none");
    await settle();
    transport.choose(id, "no");
    await settle();
    const before = finder.view(id)?.order.shortlist.map((t) => t.nctId);
    expect(finder.changeAnswer(id, "hiv", "uncontrolled")).toBe("ok");
    const after = finder.view(id)?.order.shortlist.map((t) => t.nctId);
    expect(before).toEqual(["NCT01", "NCT02", "NCT03"]);
    expect(after).toEqual(["NCT02", "NCT04", "NCT05"]);
    expect(transport.view(id)?.status).toBe("done");
    expect(finder.changeAnswer(id, "hiv", "maybe")).toBe("refused");
    expect(finder.changeAnswer(id, "ecog", "ps0")).toBe("refused");
    expect(finder.changeAnswer("nope", "hiv", "no")).toBe("unknown");
    // A second change sends no second closing message.
    finder.changeAnswer(id, "hiv", "no");
    expect(transport.delivered(id).filter((t) => t === WORDS.stopped)).toHaveLength(1);
  });

  // Found in the review passes: spend was logged only when a conversation
  // finished or was cleared, so closing the tab partway lost it.
  it("hands each reading's spend back as it goes, not only at the end", async () => {
    const { transport, id, reader } = started();
    transport.send(id, "No idea.");
    await settle();
    expect(reader.released).toBe(1);
  });

  it("forgets a conversation on start over", () => {
    const { transport, finder, id } = started();
    expect(finder.remove(id)).toBe(true);
    expect(finder.view(id)).toBeUndefined();
    expect(transport.view(id)).toBeUndefined();
  });
});

describe("parity with the conversation the measurement runs", () => {
  it("answering every question by choice gives runConversation's short list", async () => {
    const answers: Record<string, string> = {
      brain_mets: "none",
      hiv: "uncontrolled",
      pregnant_or_breastfeeding: "no",
      ecog: "ps1",
    };
    const { transport, finder, id } = started();
    for (let i = 0; i < 12 && transport.view(id)?.status !== "done"; i++) {
      const asked = transport.view(id)?.messages.at(-1)?.text;
      const factId = vocabulary.facts.find((f) => f.question === asked)?.id;
      transport.choose(id, answers[factId ?? ""] ?? UNKNOWN);
      await settle();
    }
    const expected = runConversation({
      trials: trials(),
      vocabulary,
      settings: SETTINGS,
      cancerType: "nsclc",
      sex: "female",
      answer: (factId) => answers[factId] ?? UNKNOWN,
    });
    expect(finder.view(id)?.order.shortlist.map((t) => t.nctId)).toEqual(
      expected.shortlist.map((e) => e.candidate.nctId),
    );
    expect(finder.view(id)?.answers.map((a) => a.factId)).toEqual(
      expected.steps.map((s) => s.factId),
    );
  });
});
