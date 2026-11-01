import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type AppChoice,
  catalogEntry,
  type LocalModels,
  PROVIDER_NAMES,
  type Provider,
} from "../models/index.js";
import { routeByConversation } from "../transport/route.js";
import { WebTransport } from "../transport/web/transport.js";
import { type CheckOptions, CheckService } from "./check.js";
import { type FinderOptions, FinderService } from "./finder.js";
import type { ConnectionResult } from "./models.js";
import {
  isProviderChoice,
  SettingsError,
  type SettingsPatch,
  type SettingsStore,
} from "./settings.js";

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
  /** The conversation service's data and reader; the transport is made here. */
  finder: Omit<FinderOptions, "transport">;
  /** The deeper check's data (slice 0007). It reads with the conversation's reader. Without it, there's no check. */
  check?: Omit<CheckOptions, "transport" | "reader" | "finder">;
  /** Settings. Without it, there's no Settings screen. */
  settings?: SettingsRoutesOptions;
}

export interface SettingsRoutesOptions {
  store: SettingsStore;
  /** Settings' Test: one reading, through the chosen model. Scripted in fake mode. */
  test: (choice: AppChoice) => Promise<ConnectionResult>;
  localModels: () => Promise<LocalModels>;
}

export interface App {
  finder: FinderService;
  check: CheckService | undefined;
  transport: WebTransport;
}

export function configureApp(app: FastifyInstance, options: AppOptions): App {
  const transport = new WebTransport();
  // The conversation and the check share the one transport, each with its own conversations.
  const route = routeByConversation(transport);
  const finder = new FinderService({ ...options.finder, transport: route() });
  const check =
    options.check === undefined
      ? undefined
      : new CheckService({
          ...options.check,
          transport: route(),
          reader: options.finder.reader,
          finder,
        });
  registerGuards(app, options.port);
  app.get("/api/info", () => {
    const key = options.finder.reader.current();
    return {
      mode: options.mode,
      ...options.info,
      model: options.finder.reader.name(key),
      measured: options.finder.reader.measured(key),
      // Where a reply typed now would go, for the note beside every text box.
      hosted: options.finder.reader.hosted?.(key) ?? null,
    };
  });
  transport.register(app);
  registerFinderRoutes(app, finder);
  if (check !== undefined) registerCheckRoutes(app, check);
  if (options.settings !== undefined) registerSettingsRoutes(app, options, options.settings);
  registerPage(app, options.webDir);
  return { finder, check, transport };
}

interface Params {
  id: string;
}

/**
 * The conversation's own routes (spec 0004 §9.2): start one from the search
 * form, see its short list and sheet, change an answer, stop, start over.
 * The questions and replies go through the transport's routes.
 */
function registerFinderRoutes(app: FastifyInstance, finder: FinderService): void {
  app.post("/api/finder", (request, reply) => {
    const outcome = finder.start(request.body);
    return outcome.ok
      ? reply.code(201).send({ id: outcome.id })
      : reply.code(400).send({ error: outcome.error, field: outcome.field });
  });

  app.get<{ Params: Params }>("/api/finder/:id/view", (request, reply) => {
    const view = finder.view(request.params.id);
    return view === undefined ? reply.code(404).send({ error: "unknown-conversation" }) : view;
  });

  app.put<{ Params: Params & { factId: string } }>(
    "/api/finder/:id/answers/:factId",
    (request, reply) => {
      const body = (request.body ?? {}) as { answer?: unknown };
      const outcome = finder.changeAnswer(request.params.id, request.params.factId, body.answer);
      if (outcome === "unknown") return reply.code(404).send({ error: "unknown-conversation" });
      if (outcome === "refused") return reply.code(400).send({ error: "not-an-answer" });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: Params }>("/api/finder/:id/stop", (request, reply) =>
    finder.stop(request.params.id)
      ? reply.code(204).send()
      : reply.code(404).send({ error: "unknown-conversation" }),
  );

  app.delete<{ Params: Params }>("/api/finder/:id", (request, reply) =>
    finder.remove(request.params.id)
      ? reply.code(204).send()
      : reply.code(404).send({ error: "unknown-conversation" }),
  );
}

/**
 * The check's routes (spec 0007 §6.2): which trials can be checked, start a
 * check of up to three, see its records, stop, forget it. Its questions and
 * replies go through the transport's routes, as the conversation's do.
 */
function registerCheckRoutes(app: FastifyInstance, check: CheckService): void {
  app.get<{ Params: Params }>("/api/finder/:id/checkable", (request, reply) => {
    const ids = check.checkable(request.params.id);
    return ids === undefined ? reply.code(404).send({ error: "unknown-conversation" }) : { ids };
  });

  app.post("/api/check", (request, reply) => {
    const outcome = check.start(request.body);
    return outcome.ok
      ? reply.code(201).send({ id: outcome.id })
      : reply.code(outcome.code).send({ error: outcome.error });
  });

  app.get<{ Params: Params }>("/api/check/:id/view", (request, reply) => {
    const view = check.view(request.params.id);
    return view === undefined ? reply.code(404).send({ error: "unknown-check" }) : view;
  });

  app.post<{ Params: Params }>("/api/check/:id/stop", (request, reply) =>
    check.stop(request.params.id)
      ? reply.code(204).send()
      : reply.code(404).send({ error: "unknown-check" }),
  );

  app.delete<{ Params: Params }>("/api/check/:id", (request, reply) =>
    check.remove(request.params.id)
      ? reply.code(204).send()
      : reply.code(404).send({ error: "unknown-check" }),
  );
}

/**
 * Settings. Keys go in and never come out: every answer is the store's view,
 * which has no field for one. Copied from the prescreening repository.
 *
 * Each route that changes something needs this app's own `Origin` and a JSON
 * body. The general guard lets a request with no `Origin` through, for curl
 * and tests; these don't, because what they change spends the owner's money.
 * A page on another site can't send JSON here without a preflight, which
 * this server never answers.
 */
function registerSettingsRoutes(
  app: FastifyInstance,
  options: AppOptions,
  settings: SettingsRoutesOptions,
): void {
  const { store } = settings;
  const origins = ownOrigins(options.port);
  const view = () => store.view(options.mode);

  const ownOrigin = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!origins.has(request.headers.origin ?? "")) {
      return reply.code(403).send({ error: "wrong-origin" });
    }
    const json = (request.headers["content-type"] ?? "").startsWith("application/json");
    if (request.method !== "DELETE" && !json) {
      return reply.code(403).send({ error: "json-only" });
    }
  };
  const refusing = (reply: FastifyReply, act: () => void) => {
    try {
      act();
      return view();
    } catch (error) {
      if (error instanceof SettingsError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  };

  app.get("/api/settings", view);

  app.put<{ Body: SettingsPatch }>("/api/settings", { onRequest: ownOrigin }, (request, reply) =>
    refusing(reply, () => store.update(request.body ?? {})),
  );

  app.put<{ Params: { provider: string }; Body: { key?: unknown } }>(
    "/api/settings/keys/:provider",
    { onRequest: ownOrigin },
    (request, reply) =>
      refusing(reply, () => store.saveKey(request.params.provider, request.body?.key)),
  );

  app.delete<{ Params: { provider: string } }>(
    "/api/settings/keys/:provider",
    { onRequest: ownOrigin },
    (request, reply) => refusing(reply, () => store.removeKey(request.params.provider)),
  );

  app.post<{ Body: { provider?: unknown; model?: unknown } }>(
    "/api/settings/test",
    { onRequest: ownOrigin },
    async (request, reply) => {
      const { provider, model } = request.body ?? {};
      if (!isProviderChoice(provider)) {
        return reply.code(400).send({ error: "provider must be omlx, anthropic, openai or xai" });
      }
      const name =
        provider === "omlx"
          ? store.view(options.mode).local.model
          : typeof model === "string"
            ? model
            : "";
      if (provider !== "omlx" && catalogEntry(provider as Provider, name) === undefined) {
        return reply
          .code(400)
          .send({ error: `${PROVIDER_NAMES[provider]} has no admitted model ${name}` });
      }
      return settings.test({ provider, model: name });
    },
  );

  app.get("/api/settings/local-models", () => settings.localModels());
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
