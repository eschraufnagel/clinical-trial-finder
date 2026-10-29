import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  choiceKey,
  DEFAULT_CAPS,
  hostedOf,
  logAppSpend,
  SettingsError,
  SettingsStore,
} from "../../src/server/settings.js";

/**
 * The settings store (spec 0004 §8.1), adapted from the prescreening
 * repository's tests. A value no code path may ever send back.
 */
const SENTINEL = "test-key-00000000";

function freshDir(): string {
  return join(mkdtempSync(join(tmpdir(), "finder-settings-")), "local");
}

describe("the settings store", () => {
  it("with nothing saved, chooses the local model from the environment", () => {
    const store = new SettingsStore(freshDir(), { env: { OMLX_MODEL: "Env-Model-8bit" } });
    expect(store.current()).toEqual({ provider: "omlx", model: "Env-Model-8bit" });
    expect(store.caps()).toEqual(DEFAULT_CAPS);
    expect(DEFAULT_CAPS.conversationUsd).toBe(0.1);
  });

  it("saves a choice, a key and a cap, and reads them back after a restart", () => {
    const dir = freshDir();
    const store = new SettingsStore(dir, { env: {} });
    store.saveKey("anthropic", ` ${SENTINEL} `);
    store.update({
      choice: { provider: "anthropic", model: "claude-haiku-4-5" },
      caps: { conversationUsd: 1 },
    });
    const again = new SettingsStore(dir, { env: {} });
    expect(again.current()).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
    expect(again.caps()).toEqual({ conversationUsd: 1 });
    expect(again.saved().keys).toEqual({ anthropic: SENTINEL });
    again.removeKey("anthropic");
    expect(new SettingsStore(dir, { env: {} }).saved().keys).toEqual({});
  });

  it("writes the file readable only by its owner, in a directory only they can open", () => {
    const dir = freshDir();
    new SettingsStore(dir, { env: {} }).saveKey("openai", SENTINEL);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, "settings.json")).mode & 0o777).toBe(0o600);
  });

  it("never puts a key in the view", () => {
    const store = new SettingsStore(freshDir(), { env: {} });
    for (const provider of ["anthropic", "openai", "xai", "omlx"] as const) {
      store.saveKey(provider, SENTINEL);
    }
    const view = store.view("live");
    expect(JSON.stringify(view)).not.toContain(SENTINEL);
    expect(view.providers.every((p) => p.keySaved && p.keyHint === "…0000")).toBe(true);
    expect(view.local).toMatchObject({ keySaved: true, keyHint: "…0000" });
  });

  it("marks which models were measured, priced and smoke-tested, and each provider's cheapest", () => {
    const store = new SettingsStore(freshDir(), {
      env: { OMLX_MODEL: "Local-8bit" },
      measured: ["Local-8bit", "claude-haiku-4-5"],
      estimates: { "anthropic:claude-haiku-4-5": 0.007 },
    });
    const view = store.view("live");
    const anthropic = view.providers.find((p) => p.provider === "anthropic");
    expect(anthropic?.models.find((m) => m.model === "claude-haiku-4-5")).toMatchObject({
      tested: "2026-10",
      cheapest: true,
      measured: true,
      estimateUsd: 0.007,
    });
    const openai = view.providers.find((p) => p.provider === "openai");
    expect(openai?.models.every((m) => !m.measured && m.estimateUsd === null)).toBe(true);
    expect(view.local.measured).toBe(true);
  });

  it("refuses what can't be right, and never repeats a key", () => {
    const store = new SettingsStore(freshDir(), { env: {} });
    const refused = (act: () => void) => {
      try {
        act();
      } catch (error) {
        expect(error).toBeInstanceOf(SettingsError);
        expect((error as Error).message).not.toContain(SENTINEL);
        return (error as Error).message;
      }
      throw new Error("not refused");
    };
    expect(
      refused(() => store.update({ choice: { provider: "anthropic", model: "claude-opus-5-5" } })),
    ).toMatch(/no admitted model/);
    expect(refused(() => store.update({ local: { baseUrl: "https://example.com/v1" } }))).toMatch(
      /local\.baseUrl/,
    );
    expect(refused(() => store.update({ caps: { conversationUsd: 0.01 } }))).toMatch(/between/);
    expect(refused(() => store.update({ caps: { conversationUsd: 6 } }))).toMatch(/between/);
    expect(refused(() => store.saveKey("anthropic", "  "))).toMatch(/empty/);
    expect(refused(() => store.saveKey("anthropic", `${SENTINEL} extra`))).toMatch(/space/);
    expect(refused(() => store.saveKey("anthropic", "x".repeat(501)))).toMatch(/longer/);
    expect(refused(() => store.saveKey("nobody", SENTINEL))).toMatch(/No provider/);
  });

  it("reports a file it can't read rather than starting over", () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "settings.json"), "{ not json");
    expect(() => new SettingsStore(dir, { env: {} })).toThrow(/can't be read/);
    writeFileSync(join(dir, "settings.json"), '{"version": 2}');
    expect(() => new SettingsStore(dir, { env: {} })).toThrow(/version 1/);
  });

  it("names a choice by its key, the same for any local model", () => {
    expect(choiceKey({ provider: "omlx", model: "A" })).toBe("omlx");
    expect(choiceKey({ provider: "xai", model: "grok-4.3" })).toBe("xai:grok-4.3");
    expect(hostedOf("anthropic:claude-haiku-4-5")).toEqual({
      provider: "anthropic",
      name: "Anthropic",
      model: "claude-haiku-4-5",
    });
    expect(hostedOf("omlx")).toBeNull();
    expect(hostedOf("scripted")).toBeNull();
  });

  it("logs an app's spend in the committed ledger's shape, dated by month, in its own file", () => {
    const dir = freshDir();
    logAppSpend(dir, "reader", "anthropic:claude-haiku-4-5", {
      calls: 3,
      inputTokens: 900,
      outputTokens: 90,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      usd: 0.0013,
      servedModels: ["claude-haiku-4-5-20251001"],
    });
    const line = JSON.parse(readFileSync(join(dir, "spend.jsonl"), "utf8").trim());
    expect(line).toMatchObject({ script: "app", role: "reader", calls: 3, usd: 0.0013 });
    expect(line.date).toMatch(/^\d{4}-\d{2}$/);
  });
});
