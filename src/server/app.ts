import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import type { FastifyInstance } from "fastify";

/**
 * The composition root (spec 0004 §9): the one place that knows a browser is
 * on the other end. It is given a Fastify instance rather than creating one,
 * so this file opens no socket; only `start.ts` does. Its guards and the way
 * it serves the built page are copied from the prescreening repository.
 */

export interface AppOptions {
  /** The port the server listens on; requests must be addressed to it. */
  port: number;
  /** The built page (`dist/web`). Without it, only the API is served. */
  webDir?: string;
  /** Shown on the page, so a scripted run is never mistaken for a model. */
  mode: "live" | "scripted";
  /** What `/api/info` says about the data the page runs on. */
  info: { snapshotMonth: string; mappingRun: string };
}

export function configureApp(app: FastifyInstance, options: AppOptions): void {
  registerGuards(app, options.port);
  app.get("/api/info", () => ({ mode: options.mode, ...options.info }));
  registerPage(app, options.webDir);
}

const LOCAL_NAMES: readonly string[] = ["127.0.0.1", "localhost"];

/** The origins a request from this app's own page carries. */
export function ownOrigins(port: number): Set<string> {
  return new Set(LOCAL_NAMES.map((name) => `http://${name}:${port}`));
}

/**
 * Two checks on every request.
 *
 * The `Host` must name this machine and this port. A web page elsewhere in the
 * same browser can point a name it controls at 127.0.0.1 (DNS rebinding) and
 * reach a loopback server; the request then arrives with that name in `Host`,
 * and is refused.
 *
 * A request that changes something must not come from another page's origin.
 * Browsers send `Origin` on those; a missing one (curl, tests) is allowed,
 * since only a browser can be tricked into sending a request on someone's
 * behalf.
 */
function registerGuards(app: FastifyInstance, port: number): void {
  const allowed = new Set(LOCAL_NAMES.map((name) => `${name}:${port}`));
  const origins = ownOrigins(port);

  app.addHook("onRequest", async (request, reply) => {
    if (!allowed.has(request.headers.host ?? "")) {
      return reply.code(421).send({ error: "wrong-host" });
    }
    const origin = request.headers.origin;
    if (request.method !== "GET" && origin !== undefined && !origins.has(origin)) {
      return reply.code(403).send({ error: "foreign-origin" });
    }
  });
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

/**
 * Serves the built page. The file list is read once, and a request is
 * answered only with a file on that list: no filesystem path is ever built
 * from a request, so none can escape the directory. Any other path gets the
 * page, except under `/api`, which gets a JSON 404.
 */
function registerPage(app: FastifyInstance, webDir: string | undefined): void {
  const files = new Map<string, { body: Buffer; type: string }>();
  if (webDir !== undefined) {
    for (const path of listFiles(webDir)) {
      const url = `/${relative(webDir, path).split(sep).join("/")}`;
      files.set(url, {
        body: readFileSync(path),
        type: CONTENT_TYPES[extname(path)] ?? "application/octet-stream",
      });
    }
  }
  const index = files.get("/index.html");

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0] ?? "/";
    if (request.method !== "GET" || path === "/api" || path.startsWith("/api/")) {
      return reply.code(404).send({ error: "not-found" });
    }
    const file = files.get(path) ?? index;
    if (file === undefined) {
      return reply.code(404).send({ error: "the page has not been built; run npm run app" });
    }
    return reply.type(file.type).send(file.body);
  });
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
