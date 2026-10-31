import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "../../src/facts/types.js";
import { readReply } from "../../src/questions/read.js";
import { ConversationModel, settingsReader, testConnection } from "../../src/server/models.js";
import { SettingsStore } from "../../src/server/settings.js";
import { type Fixture, fixtureFetch, loadFixture, SENTINEL_KEY } from "../models/fixtures.js";

/**
 * The page's reader from Settings (spec 0004 §8.3), over a recorded Anthropic
 * response with its text replaced by a reading. No key but the sentinel, and
 * no network.
 */
const HAIKU = { provider: "anthropic" as const, model: "claude-haiku-4-5" };
const KEY = "anthropic:claude-haiku-4-5";

const FACT: Fact = {
  id: "pet",
  question: "Do you have a cat?",
  answers: [
    { id: "yes", words: "Yes" },
    { id: "no", words: "No" },
  ],
  whoKnows: "patient",
  cancerTypes: "all",
};

/** The recorded success, with its text a reading of `answer`. */
function reading(answer: string): Fixture {
  const fixture = loadFixture("anthropic", "read-ok");
  const body = fixture.body as { content: { type: string; text: string }[] };
  return {
    ...fixture,
    provenance: `${fixture.provenance}, text replaced by a reading`,
    body: { ...body, content: [{ type: "text", text: JSON.stringify({ answer }) }] },
  };
}

function storeWithKey(): SettingsStore {
  const store = new SettingsStore(join(mkdtempSync(join(tmpdir(), "finder-models-")), "local"), {
    env: {},
    measured: [{ model: "claude-haiku-4-5", readable: 0.45, exact: 1, invented: 0 }],
  });
  store.saveKey("anthropic", SENTINEL_KEY);
  store.update({ choice: HAIKU });
  return store;
}

function spendLines(store: SettingsStore): { role: string; spec: string; calls: number }[] {
  const path = join(store.dir, "spend.jsonl");
  return existsSync(path)
    ? readFileSync(path, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
}

describe("the reader from Settings", () => {
  it("names a new conversation's model by what Settings chose, and whether it was measured", () => {
    const reader = settingsReader({ store: storeWithKey(), env: {} });
    expect(reader.current()).toBe(KEY);
    expect(reader.name(KEY)).toBe("Anthropic · claude-haiku-4-5");
    expect(reader.measured(KEY)).toBe(true);
    expect(reader.hosted?.(KEY)).toBe("Anthropic");
    expect(reader.hosted?.("omlx")).toBeNull();
  });

  it("keeps one budget across a conversation's readings, and logs its spend once released", async () => {
    const store = storeWithKey();
    const { fetchImpl, sent } = fixtureFetch(reading("yes"), reading("no"));
    const model = new ConversationModel(KEY, { store, env: {}, fetchImpl });
    expect((await readReply(FACT, "A tabby.", model)).answer).toBe("yes");
    expect((await readReply(FACT, "No pets.", model)).answer).toBe("no");
    expect(sent).toHaveLength(2);
    expect(spendLines(store)).toEqual([]);
    model.release();
    expect(spendLines(store)).toEqual([
      expect.objectContaining({ role: "reader", spec: KEY, calls: 2 }),
    ]);
    model.release();
    expect(spendLines(store)).toHaveLength(1);
  });

  it("refuses to continue a conversation on a model it didn't start on", async () => {
    const store = storeWithKey();
    const model = new ConversationModel(KEY, { store, env: {} });
    store.update({ choice: { provider: "openai", model: "gpt-6-luna" } });
    await expect(readReply(FACT, "Yes.", model)).rejects.toThrow(/can't continue on another model/);
  });

  it("with no key saved, says so in words the page can show", async () => {
    const store = storeWithKey();
    store.removeKey("anthropic");
    const model = new ConversationModel(KEY, { store, env: {} });
    await expect(readReply(FACT, "Yes.", model)).rejects.toMatchObject({
      problems: [expect.stringMatching(/No key saved for Anthropic/)],
    });
  });

  it("never repeats the key, even when the provider's error does", async () => {
    const store = storeWithKey();
    const echoing = (async (_url: string, init: RequestInit = {}) => {
      const headers = init.headers as Record<string, string>;
      return new Response(
        JSON.stringify({ error: { message: `bad key ${headers["x-api-key"]}` } }),
        { status: 401 },
      );
    }) as unknown as typeof fetch;
    const model = new ConversationModel(KEY, { store, env: {}, fetchImpl: echoing });
    const error = await readReply(FACT, "Yes.", model).catch((e: unknown) => e);
    expect(JSON.stringify(error)).not.toContain(SENTINEL_KEY);
    expect(String((error as Error).message)).not.toContain(SENTINEL_KEY);
  });
});

describe("the connection test", () => {
  it("reads one made-up reply, and says whether it was read right", async () => {
    const store = storeWithKey();
    const { fetchImpl, sent } = fixtureFetch(reading("yes"));
    const result = await testConnection({ store, env: {}, fetchImpl }, HAIKU);
    expect(result).toMatchObject({ ok: true, servedModel: "claude-haiku-4-5-20251001" });
    expect(sent).toHaveLength(1);
    expect(spendLines(store)).toEqual([expect.objectContaining({ role: "check", calls: 1 })]);
  });

  it("fails when the model answers but reads the reply wrong", async () => {
    const store = storeWithKey();
    const { fetchImpl } = fixtureFetch(reading("no"));
    const result = await testConnection({ store, env: {}, fetchImpl }, HAIKU);
    expect(result).toMatchObject({ ok: false, problem: expect.stringMatching(/read .* as no/) });
  });

  it("never repeats the key, even when the provider's error does", async () => {
    const store = storeWithKey();
    const echoing = (async (_url: string, init: RequestInit = {}) => {
      const headers = init.headers as Record<string, string>;
      return new Response(
        JSON.stringify({ error: { message: `bad key ${headers["x-api-key"]}` } }),
        { status: 401 },
      );
    }) as unknown as typeof fetch;
    const result = await testConnection({ store, env: {}, fetchImpl: echoing }, HAIKU);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SENTINEL_KEY);
  });
});
