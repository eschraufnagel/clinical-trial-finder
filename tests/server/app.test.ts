import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { configureApp } from "../../src/server/app.js";

/** The server in memory, through `inject`: no socket is opened. */
function app() {
  const server = Fastify();
  configureApp(server, {
    port: 5099,
    mode: "scripted",
    info: { snapshotMonth: "2000-01", mappingRun: "run" },
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
