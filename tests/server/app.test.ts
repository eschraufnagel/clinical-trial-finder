import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { configureApp } from "../../src/server/app.js";
import { SettingsStore } from "../../src/server/settings.js";
import { checkOptions, FORM, finderOptions, settle } from "./fixture.js";

/** The server in memory, through `inject`: no socket is opened. */
function app(store?: SettingsStore) {
  const server = Fastify();
  configureApp(server, {
    port: 5099,
    mode: "scripted",
    info: { snapshotMonth: "2000-01", mappingRun: "run" },
    finder: finderOptions(),
    check: checkOptions(),
    ...(store === undefined
      ? {}
      : {
          settings: {
            store,
            test: async () => ({ ok: true as const, usd: 0, servedModel: "scripted", read: "x" }),
            localModels: async () => ({ reachable: false, models: [] }),
          },
        }),
  });
  return server;
}

const HOST = { host: "127.0.0.1:5099" };

describe("the server's guards and info", () => {
  it("says what the page runs on", async () => {
    const res = await app().inject({ url: "/api/info", headers: HOST });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mode: "scripted",
      snapshotMonth: "2000-01",
      mappingRun: "run",
      model: "a scripted reader",
      measured: false,
      hosted: null,
    });
  });

  it("refuses a request addressed to another host, or another port", async () => {
    for (const host of ["evil.example:5099", "127.0.0.1:5100"]) {
      const res = await app().inject({ url: "/api/info", headers: { host } });
      expect(res.statusCode).toBe(421);
    }
  });

  it("refuses a change from another page's origin, and allows one with none", async () => {
    const foreign = await app().inject({
      method: "POST",
      url: "/api/nothing",
      headers: { ...HOST, origin: "https://evil.example" },
    });
    expect(foreign.statusCode).toBe(403);
    const none = await app().inject({ method: "POST", url: "/api/nothing", headers: HOST });
    expect(none.statusCode).toBe(404);
  });

  it("answers an unknown API path with JSON, and says when the page isn't built", async () => {
    expect((await app().inject({ url: "/api/nope", headers: HOST })).json()).toEqual({
      error: "not-found",
    });
    expect((await app().inject({ url: "/", headers: HOST })).json()).toEqual({
      error: "the page has not been built; run npm run app",
    });
  });
});

describe("the conversation's routes", () => {
  const post = (server: ReturnType<typeof app>, url: string, payload: unknown) =>
    server.inject({ method: "POST", url, headers: HOST, payload: payload as object });

  it("start a conversation, take a choice, and show the view", async () => {
    const server = app();
    const started = await post(server, "/api/finder", FORM);
    expect(started.statusCode).toBe(201);
    const { id } = started.json() as { id: string };
    const sent = await post(server, `/api/conversations/${id}/messages`, { choice: "none" });
    expect(sent.statusCode).toBe(202);
    await settle();
    const view = await server.inject({ url: `/api/finder/${id}/view`, headers: HOST });
    expect(view.statusCode).toBe(200);
    expect(view.json().answers).toEqual([
      expect.objectContaining({ factId: "brain_mets", answer: "none" }),
    ]);
    expect(view.json().order.shortlist).toHaveLength(3);
    expect(view.json().sheet.title).toEqual({ ours: "For your oncologist" });
  });

  it("refuse a bad form naming the field, and a stale choice", async () => {
    const server = app();
    const bad = await post(server, "/api/finder", { ...FORM, age: "sixty" });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ field: "age" });
    const { id } = (await post(server, "/api/finder", FORM)).json() as { id: string };
    const stale = await post(server, `/api/conversations/${id}/messages`, { choice: "confirm" });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "not-a-choice" });
  });

  it("change an answer, stop, and start over", async () => {
    const server = app();
    const { id } = (await post(server, "/api/finder", FORM)).json() as { id: string };
    await post(server, `/api/conversations/${id}/messages`, { choice: "none" });
    await settle();
    const put = (factId: string, answer: unknown) =>
      server.inject({
        method: "PUT",
        url: `/api/finder/${id}/answers/${factId}`,
        headers: HOST,
        payload: { answer } as object,
      });
    expect((await put("brain_mets", "symptoms")).statusCode).toBe(204);
    expect((await put("brain_mets", "maybe")).statusCode).toBe(400);
    expect((await post(server, `/api/finder/${id}/stop`, {})).statusCode).toBe(204);
    const del = await server.inject({ method: "DELETE", url: `/api/finder/${id}`, headers: HOST });
    expect(del.statusCode).toBe(204);
    const gone = await server.inject({ url: `/api/finder/${id}/view`, headers: HOST });
    expect(gone.statusCode).toBe(404);
  });
});

describe("the check's routes (slice 0007)", () => {
  const post = (server: ReturnType<typeof app>, url: string, payload: unknown) =>
    server.inject({ method: "POST", url, headers: HOST, payload: payload as object });

  it("say which trials can be checked, start a check, take a tap through the transport, and show the records", async () => {
    const server = app();
    const { id: finderId } = (await post(server, "/api/finder", FORM)).json() as { id: string };
    // Answering brain metastases carries the fixture's ECOG rule, so one rule is left to ask.
    await post(server, `/api/conversations/${finderId}/messages`, { choice: "none" });
    await settle();
    const checkable = await server.inject({
      url: `/api/finder/${finderId}/checkable`,
      headers: HOST,
    });
    expect(checkable.json().ids).toContain("NCT01");

    const started = await post(server, "/api/check", { finderId, nctIds: ["NCT01"] });
    expect(started.statusCode).toBe(201);
    const { id } = started.json() as { id: string };
    await settle();
    expect(
      (await post(server, `/api/conversations/${id}/messages`, { choice: "yes" })).statusCode,
    ).toBe(202);
    await settle();
    const view = await server.inject({ url: `/api/check/${id}/view`, headers: HOST });
    expect(view.json()).toMatchObject({ done: true, trials: [{ nctId: "NCT01" }] });
    expect(view.json().records[0].told.lines).toHaveLength(1);

    // The conversation's own messages are untouched by the check's.
    const said = await server.inject({
      url: `/api/conversations/${finderId}/messages`,
      headers: HOST,
    });
    expect(said.json().messages.every((m: { text: string }) => !/contraception/.test(m.text))).toBe(
      true,
    );
  });

  it("refuse four trials and an unknown conversation; stop and forget a check", async () => {
    const server = app();
    const { id: finderId } = (await post(server, "/api/finder", FORM)).json() as { id: string };
    const four = await post(server, "/api/check", {
      finderId,
      nctIds: ["NCT01", "NCT02", "NCT03", "NCT04"],
    });
    expect(four.statusCode).toBe(400);
    expect(
      (await post(server, "/api/check", { finderId: "x", nctIds: ["NCT01"] })).statusCode,
    ).toBe(404);
    const { id } = (await post(server, "/api/check", { finderId, nctIds: ["NCT01"] })).json() as {
      id: string;
    };
    await settle();
    expect((await post(server, `/api/check/${id}/stop`, {})).statusCode).toBe(204);
    const del = await server.inject({ method: "DELETE", url: `/api/check/${id}`, headers: HOST });
    expect(del.statusCode).toBe(204);
    expect((await server.inject({ url: `/api/check/${id}/view`, headers: HOST })).statusCode).toBe(
      404,
    );
  });
});

describe("the Settings routes", () => {
  const SENTINEL = "test-key-00000000";
  const ORIGIN = { ...HOST, origin: "http://127.0.0.1:5099" };
  const store = () =>
    new SettingsStore(join(mkdtempSync(join(tmpdir(), "finder-app-")), "local"), { env: {} });

  it("save a key and choose a model from this page only, and never send a key back", async () => {
    const server = app(store());
    const bodies: string[] = [];
    const send = async (method: "PUT" | "DELETE" | "POST", url: string, payload?: object) => {
      const res = await server.inject({
        method,
        url,
        headers: ORIGIN,
        ...(payload === undefined ? {} : { payload }),
      });
      bodies.push(res.body);
      return res;
    };
    expect((await send("PUT", "/api/settings/keys/anthropic", { key: SENTINEL })).statusCode).toBe(
      200,
    );
    const chosen = await send("PUT", "/api/settings", {
      choice: { provider: "anthropic", model: "claude-haiku-4-5" },
    });
    expect(chosen.json().choice).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
    expect(
      (
        await send("POST", "/api/settings/test", {
          provider: "anthropic",
          model: "claude-haiku-4-5",
        })
      ).json(),
    ).toMatchObject({ ok: true });
    bodies.push((await server.inject({ url: "/api/settings", headers: HOST })).body);
    expect((await send("DELETE", "/api/settings/keys/anthropic")).statusCode).toBe(200);
    expect(bodies.length).toBe(5);
    expect(bodies.filter((b) => b.includes(SENTINEL))).toEqual([]);
  });

  it("refuse a write from no origin, another origin, or without JSON", async () => {
    const server = app(store());
    const put = (headers: Record<string, string>, payload: string) =>
      server.inject({ method: "PUT", url: "/api/settings/keys/anthropic", headers, payload });
    const json = { "content-type": "application/json" };
    expect((await put({ ...HOST, ...json }, `{"key":"${SENTINEL}"}`)).json()).toEqual({
      error: "wrong-origin",
    });
    expect((await put({ ...HOST, ...json, origin: "https://evil.example" }, "{}")).statusCode).toBe(
      403,
    );
    expect((await put({ ...ORIGIN, "content-type": "text/plain" }, SENTINEL)).json()).toEqual({
      error: "json-only",
    });
  });

  it("refuse a setting that can't be right, saying why", async () => {
    const server = app(store());
    const res = await server.inject({
      method: "PUT",
      url: "/api/settings",
      headers: ORIGIN,
      payload: { caps: { conversationUsd: 9 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/between/);
  });
});
