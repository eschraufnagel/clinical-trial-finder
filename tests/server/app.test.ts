import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { configureApp } from "../../src/server/app.js";
import { FORM, finderOptions, settle } from "./fixture.js";

/** The server in memory, through `inject`: no socket is opened. */
function app() {
  const server = Fastify();
  configureApp(server, {
    port: 5099,
    mode: "scripted",
    info: { snapshotMonth: "2000-01", mappingRun: "run" },
    finder: finderOptions(),
  });
  return server;
}

const HOST = { host: "127.0.0.1:5099" };

describe("the server's guards and info", () => {
  it("says what the page runs on", async () => {
    const res = await app().inject({ url: "/api/info", headers: HOST });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ mode: "scripted", snapshotMonth: "2000-01", mappingRun: "run" });
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
