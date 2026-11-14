import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The executable form of this project's binding constraint: the running
 * application depends on no remote service.
 *
 * Asserted by walking the module graph reachable from each module's public
 * entry point and inspecting the source, rather than by mocking `fetch` at
 * runtime — a runtime mock only proves the code paths a test happened to
 * execute.
 *
 * ## The exception, and why it is shaped this way
 *
 * Slice 0002 introduced `src/models/`, which talks to a local model runtime
 * over HTTP. That is the first thing under `src/` to open a socket, and rather
 * than loosen the rule everywhere it is admitted here under two conditions:
 * only `fetch()`, and only to a host on this machine.
 *
 * The exception is applied **per file, not per module graph**. `src/criteria/`
 * imports `src/models/`, so an allowance granted to everything reachable from
 * an entry point that touches the adapter would silently exempt the parser too
 * — which is exactly the rule the parser needs to be under.
 *
 * ## Three frontier hosts, from slice 0008, each in its own file
 *
 * Slice 0008 added adapters for Anthropic, OpenAI and xAI. Each host is a
 * literal in exactly one named file under `src/models/` (`FRONTIER_HOSTS`
 * below), and any other non-loopback host there fails this suite. They are
 * reached only from scripts a person runs with `--spend`: the running
 * application gets its adapter from `createLocalAdapter`, which refuses them,
 * and a test below fails if it names `createAdapter`. Adding a host means
 * adding it here, in the open.
 *
 * ## Two more, from slice 0005, shaped the same way
 *
 * A local server has to listen, and a page has to reach it. Each is admitted
 * in named files only, and only in its narrowest form. This repository has no
 * server or page yet; the rules are inherited from the prescreening repository
 * so that the first slice to add one meets them rather than writes them.
 *
 * - **Listening:** only `src/server/start.ts` may import `fastify` as a value
 *   or call `listen()`, and every `listen()` there must take
 *   `host: LOOPBACK_HOST`, a constant set to `127.0.0.1`. Everything else that
 *   touches Fastify is handed an instance by type, and opens nothing.
 * - **Browser requests:** only `src/transport/web/client.ts` may call
 *   `fetch()`, and only with a string or template literal starting with `/`:
 *   the page's own origin, never a variable that could hold a URL. Slice
 *   0004 adds the page's own API client, `src/web/api.ts`, to the list.
 *
 * ## One registry host, from slice 0013
 *
 * The trial snapshot is fetched by a script through `src/trials/registry.ts`.
 * Only that file may call `fetch()` for it, and the only host it may
 * name is `clinicaltrials.gov`. Every other file under `src/trials/` stays
 * under the absolute rule, so the loader still reads fixtures and nothing
 * else.
 */
const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));
const FETCH_SCRIPT = fileURLToPath(new URL("../scripts/fetch-trials.ts", import.meta.url));
const REGISTRY_SOURCE = fileURLToPath(new URL("../src/trials/registry.ts", import.meta.url));

/** The one file outside `src/models/` allowed `fetch()`, and the one host it may name (slice 0013). */
const REGISTRY_FILE = `${sep}trials${sep}registry.ts`;
const REGISTRY_HOST = "clinicaltrials.gov";

/** The one directory allowed to reach the network, and the only thing it may use. */
const NETWORK_EXEMPT_DIR = `${sep}models${sep}`;
const EXEMPT_PATTERN = "fetch()";

/** The one file allowed to listen, on loopback only. */
const LISTEN_FILE = `${sep}server${sep}start.ts`;
/** Browser files allowed `fetch()` by relative literal only. */
const RELATIVE_FETCH_FILES: readonly string[] = [
  `${sep}transport${sep}web${sep}client.ts`,
  // Slice 0004: the page's own API client.
  `${sep}web${sep}api.ts`,
];
/** Entry points with no `index.ts`: the browser half of the transport, and the page (slice 0004). */
const EXTRA_ENTRIES: readonly string[] = [
  fileURLToPath(new URL("../src/transport/web/client.ts", import.meta.url)),
  fileURLToPath(new URL("../src/web/main.tsx", import.meta.url)),
];

/** Hosts a network-exempt module may address. Mirrors `LOOPBACK_HOSTS` in config.ts. */
const LOOPBACK_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "[::1]", "::1"];

/**
 * The frontier hosts, and the only files under `src/models/` that may name
 * each (slice 0008). A literal map, so widening it is a visible diff.
 */
const FRONTIER_HOSTS: Readonly<Record<string, readonly string[]>> = {
  "api.anthropic.com": [`${sep}models${sep}anthropic.ts`, `${sep}models${sep}anthropic-batch.ts`],
  "api.openai.com": [`${sep}models${sep}openai.ts`],
  "api.x.ai": [`${sep}models${sep}xai.ts`],
};

/** Hosts in a network-exempt file that it may not name: not loopback, not its own frontier host. */
function forbiddenHosts(file: string, source?: string): string[] {
  return findHosts(file, source).filter(
    (host) =>
      !LOOPBACK_HOSTS.includes(host) &&
      !(FRONTIER_HOSTS[host] ?? []).some((allowed) => file.endsWith(allowed)),
  );
}

/** Things that reach the network, matched against source with comments removed. */
const NETWORK_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: EXEMPT_PATTERN, pattern: /\bfetch\s*\(/ },
  { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { name: "node:http / node:https", pattern: /["']node:https?["']/ },
  {
    name: "http / https module",
    pattern: /require\s*\(\s*["']https?["']\s*\)|from\s+["']https?["']/,
  },
  { name: "node-fetch", pattern: /["']node-fetch["']/ },
  { name: "undici", pattern: /["']undici["']/ },
  { name: "axios", pattern: /["']axios["']/ },
  { name: "WebSocket", pattern: /\bnew\s+WebSocket\b/ },
  // A value import only. `import type { FastifyInstance }` is erased and opens nothing.
  { name: "fastify", pattern: /^\s*import\s+(?!type\b)[^;]*?from\s+["']fastify["']/m },
  { name: "listen()", pattern: /\.listen\s*\(/ },
];

/**
 * Removes comments so that prose about the network is not mistaken for code
 * that uses it. Several files say "no network, ever" and point at
 * `npm run fetch:trials`, and a grep that flagged those would be useless.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isNetworkExempt(file: string): boolean {
  return file.includes(NETWORK_EXEMPT_DIR);
}

function isRegistryFile(file: string): boolean {
  return file.endsWith(REGISTRY_FILE);
}

function isListenFile(file: string): boolean {
  return file.endsWith(LISTEN_FILE);
}

function isRelativeFetchFile(file: string): boolean {
  return RELATIVE_FETCH_FILES.some((f) => file.endsWith(f));
}

/** Every `fetch(` takes a string or template literal starting with `/`. */
function fetchesAreRelative(code: string): boolean {
  const calls = code.match(/\bfetch\s*\(/g)?.length ?? 0;
  const relative = code.match(/\bfetch\s*\(\s*["'`]\//g)?.length ?? 0;
  return calls === relative;
}

/** Every `listen(` passes `host: LOOPBACK_HOST`, and that constant is loopback. */
function listensOnLoopback(code: string): boolean {
  const calls = code.match(/\.listen\s*\(/g)?.length ?? 0;
  const loopback =
    code.match(/\.listen\s*\(\s*\{[^}]*\bhost:\s*LOOPBACK_HOST\b[^}]*\}/g)?.length ?? 0;
  return calls === loopback && /\bLOOPBACK_HOST\s*=\s*"127\.0\.0\.1"/.test(code);
}

/** Network usage that is not permitted in this particular file. */
function findNetworkUsage(file: string, source?: string): string[] {
  const code = stripComments(source ?? readFileSync(file, "utf8"));

  return NETWORK_PATTERNS.filter(({ name, pattern }) => {
    if (!pattern.test(code)) {
      return false;
    }
    if (name === EXEMPT_PATTERN) {
      if (isNetworkExempt(file) || isRegistryFile(file)) {
        return false;
      }
      if (isRelativeFetchFile(file)) {
        return !fetchesAreRelative(code);
      }
    }
    if (name === "fastify" && isListenFile(file)) {
      return false;
    }
    if (name === "listen()" && isListenFile(file)) {
      return !listensOnLoopback(code);
    }
    return true;
  }).map(({ name }) => name);
}

/** Hosts appearing as URL literals in a file, whether or not it is exempt. */
function findHosts(file: string, source?: string): string[] {
  const code = stripComments(source ?? readFileSync(file, "utf8"));
  const hosts: string[] = [];

  for (const match of code.matchAll(/https?:\/\/([^/"'`\s:]+|\[[^\]]+\])/g)) {
    const host = match[1];
    if (host !== undefined) {
      hosts.push(host);
    }
  }

  return hosts;
}

/**
 * Drops type-only imports, which are erased before anything runs.
 *
 * `import type { X } from "./y.js"` emits no require and no module load, so a
 * file reached only that way cannot execute, cannot open a socket and cannot
 * call a parser. Following it overstates reachability: `src/criteria/types.ts`
 * imports `ModelRunMetadata` from the models barrel, which would otherwise put
 * every adapter in the import graph of anything that names a criterion type.
 *
 * Only the fully type-only form is removed. `import { type A, b }` still loads
 * the module for `b` and is left alone.
 */
function stripTypeOnlyImports(source: string): string {
  return source.replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "");
}

/** Walks relative imports, mapping the ESM `.js` specifier back to its `.ts` source. */
function reachableModules(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) {
      continue;
    }
    seen.add(file);

    const source = stripTypeOnlyImports(stripComments(readFileSync(file, "utf8")));
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier === undefined) {
        continue;
      }
      // `.js` names the compiled file: the source is `.ts`, or `.tsx` in the page.
      const base = resolve(dirname(file), specifier.replace(/\.js$/, ""));
      const resolved = [`${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (resolved !== undefined) {
        queue.push(resolved);
      }
    }
  }

  return [...seen];
}

/**
 * Every module's public entry point, discovered rather than listed.
 *
 * A hardcoded list would silently stop covering a module added in a later
 * slice, which is the failure this whole file exists to prevent.
 */
function entryPoints(): string[] {
  return readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => resolve(SRC_DIR, item.name, "index.ts"))
    .concat(EXTRA_ENTRIES)
    .filter((path) => existsSync(path));
}

describe("no network under src/", () => {
  const entries = entryPoints();
  const modules = [...new Set(entries.flatMap(reachableModules))];

  // Without this, a walker that silently returned nothing would make the
  // assertions below pass by examining zero files.
  it("actually walks the module graph from every module entry point", () => {
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(modules.length).toBeGreaterThanOrEqual(8);
    expect(modules.some((m) => m.endsWith("load.ts"))).toBe(true);
    expect(modules.some((m) => m.endsWith("validate.ts"))).toBe(true);
    expect(modules.some((m) => m.endsWith("corpus.ts"))).toBe(true);
    expect(modules.some((m) => m.endsWith(`models${sep}omlx.ts`))).toBe(true);
    // Slice 0004: the screening agent is walked like everything else.
    expect(modules.length).toBeGreaterThanOrEqual(20);
    expect(modules.some((m) => m.endsWith(`screening${sep}session.ts`))).toBe(true);
    // Slice 0005: the browser client.
    expect(modules.some((m) => m.endsWith(`transport${sep}web${sep}client.ts`))).toBe(true);
    // Slice 0004 of this repository: the page and the server.
    expect(modules.some((m) => m.endsWith(`web${sep}main.tsx`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`server${sep}start.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`plain${sep}render.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`plain${sep}load.ts`))).toBe(true);
  });

  it("reaches nothing that touches the network, outside the models module", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);

    expect(offenders).toEqual([]);
  });

  // The exception is for one directory and one function. A models file that
  // reached for axios or node:http would still fail the assertion above.
  it("exempts only the models module, and only fetch()", () => {
    const exempt = modules.filter(isNetworkExempt);

    expect(exempt.length).toBeGreaterThanOrEqual(3);
    expect(findNetworkUsage("/src/models/omlx.ts", "await fetch(url);")).toEqual([]);
    expect(findNetworkUsage("/src/models/omlx.ts", "import http from 'node:http';")).toEqual([
      "node:http / node:https",
    ]);
  });

  // Applied per file rather than per graph: src/criteria/ imports src/models/,
  // and a graph-level allowance would exempt the parser along with the adapter.
  it("does not extend the exemption to files that merely import the adapter", () => {
    expect(findNetworkUsage("/src/criteria/parse.ts", "await fetch(url);")).toEqual(["fetch()"]);
  });

  // Slice 0005's two exceptions, each proved to fire.
  it("lets only start.ts import fastify as a value, and a type import anywhere", () => {
    expect(findNetworkUsage("/src/screening/session.ts", 'import Fastify from "fastify";')).toEqual(
      ["fastify"],
    );
    expect(findNetworkUsage("/src/server/app.ts", 'import Fastify from "fastify";')).toEqual([
      "fastify",
    ]);
    expect(
      findNetworkUsage("/src/server/app.ts", 'import type { FastifyInstance } from "fastify";'),
    ).toEqual([]);
  });

  it("lets start.ts listen only on the loopback constant", () => {
    const good =
      'import Fastify from "fastify";\nexport const LOOPBACK_HOST = "127.0.0.1";\n' +
      "await app.listen({ host: LOOPBACK_HOST, port });";
    expect(findNetworkUsage("/src/server/start.ts", good)).toEqual([]);
    expect(
      findNetworkUsage(
        "/src/server/start.ts",
        good.replace("host: LOOPBACK_HOST", 'host: "0.0.0.0"'),
      ),
    ).toEqual(["listen()"]);
    expect(
      findNetworkUsage("/src/server/start.ts", good.replace('"127.0.0.1"', '"0.0.0.0"')),
    ).toEqual(["listen()"]);
    expect(findNetworkUsage("/src/server/app.ts", "await app.listen({ port: 80 });")).toEqual([
      "listen()",
    ]);
  });

  it("lets the browser files fetch only relative literals, and nothing else fetch at all", () => {
    const client = "/src/transport/web/client.ts";
    expect(findNetworkUsage(client, "await fetch(`/api/conversations/c1/messages`);")).toEqual([]);
    expect(findNetworkUsage(client, 'await fetch("/api/info");')).toEqual([]);
    expect(findNetworkUsage(client, 'await fetch("http://example.com/api");')).toEqual(["fetch()"]);
    expect(findNetworkUsage(client, "await fetch(url);")).toEqual(["fetch()"]);
    expect(findNetworkUsage("/src/web/App.tsx", 'await fetch("/api/info");')).toEqual(["fetch()"]);
  });

  // Every file under src/models/, reachable or not, so a host can't sit in a
  // file nothing imports yet and slip in later.
  it("lets the models module address this machine, and each frontier host only in its own file", () => {
    const offenders = allSourceFiles(SRC_DIR)
      .filter(isNetworkExempt)
      .map((file) => ({ file, hosts: forbiddenHosts(file) }))
      .filter(({ hosts }) => hosts.length > 0);

    expect(offenders).toEqual([]);
  });

  // Proves the map is live: each host really is named where it's allowed.
  it("finds each frontier host in the file named for it", () => {
    for (const [host, files] of Object.entries(FRONTIER_HOSTS)) {
      const naming = allSourceFiles(SRC_DIR).filter((f) => findHosts(f).includes(host));
      expect(naming.length, host).toBeGreaterThan(0);
      expect(
        naming.every((f) => files.some((allowed) => f.endsWith(allowed))),
        host,
      ).toBe(true);
    }
  });

  // Slice 0013: the registry file fetches, and names one host.
  it("lets only registry.ts under src/trials/ fetch, and only from clinicaltrials.gov", () => {
    expect(existsSync(REGISTRY_SOURCE)).toBe(true);
    expect(findHosts(REGISTRY_SOURCE)).toEqual([REGISTRY_HOST]);
    const others = allSourceFiles(join(SRC_DIR, "trials"))
      .filter((f) => !isRegistryFile(f))
      .map((file) => ({ file, usage: findNetworkUsage(file), hosts: findHosts(file) }))
      .filter(({ usage, hosts }) => usage.length > 0 || hosts.length > 0);
    expect(others).toEqual([]);
  });

  it("would catch a fetch in another trials file, or another host in the registry file", () => {
    expect(findNetworkUsage("/src/trials/load.ts", "await fetch(url);")).toEqual(["fetch()"]);
    expect(findNetworkUsage("/src/server/trials.ts", "await fetch(url);")).toEqual(["fetch()"]);
    expect(findNetworkUsage("/src/trials/registry.ts", "import http from 'node:http';")).toEqual([
      "node:http / node:https",
    ]);
    expect(
      findHosts("/src/trials/registry.ts", 'await fetch("https://example.com/api");'),
    ).not.toEqual([REGISTRY_HOST]);
  });

  // The fetch script must not be reachable from any application entry point.
  it("does not reach the fetch script", () => {
    expect(modules).not.toContain(FETCH_SCRIPT);
  });

  // Proves the detector works. If this ever passes with an empty result, the
  // assertions above are meaningless and every other test here is theatre.
  it("detects network use in the registry file, which is the known offender", () => {
    const source = readFileSync(REGISTRY_SOURCE, "utf8");
    expect(findNetworkUsage("/src/trials/load.ts", source)).toContain("fetch()");
  });

  // Proves the host rule works. A check that cannot fail is not doing its job.
  it("detects a non-loopback host in an otherwise exempt file", () => {
    const source = 'const url = "https://api.example.com/v1/chat/completions";';
    const hosts = findHosts("/src/models/omlx.ts", source);

    expect(hosts).toEqual(["api.example.com"]);
    expect(forbiddenHosts("/src/models/omlx.ts", source)).toEqual(["api.example.com"]);
  });

  // A frontier host is allowed in its own file and nowhere else, not even
  // another frontier adapter.
  it("detects a frontier host in the wrong file", () => {
    const anthropic = 'const u = "https://api.anthropic.com/v1/messages";';
    expect(forbiddenHosts(`${sep}src${sep}models${sep}anthropic.ts`, anthropic)).toEqual([]);
    expect(forbiddenHosts(`${sep}src${sep}models${sep}openai.ts`, anthropic)).toEqual([
      "api.anthropic.com",
    ]);
    expect(forbiddenHosts(`${sep}src${sep}models${sep}omlx.ts`, anthropic)).toEqual([
      "api.anthropic.com",
    ]);
  });

  it("accepts the loopback forms the adapter actually uses", () => {
    const source = 'const a = "http://127.0.0.1:8000/v1"; const b = "http://localhost:8000/v1";';

    expect(
      findHosts("/src/models/config.ts", source).every((h) => LOOPBACK_HOSTS.includes(h)),
    ).toBe(true);
  });

  // Proves the type-import rule is precise: it must not drop a value import
  // that happens to mention a type.
  it("drops only fully type-only imports", () => {
    expect(stripTypeOnlyImports('import type { A } from "./a.js";')).not.toMatch(/a\.js/);
    expect(stripTypeOnlyImports('import { type A, b } from "./a.js";')).toMatch(/a\.js/);
    expect(stripTypeOnlyImports('import { a } from "./a.js";')).toMatch(/a\.js/);
  });

  // Proves the comment stripper does not hide real code.
  it("does not let a comment conceal a network call", () => {
    const withComment = stripComments("// we never call fetch() here\nawait fetch(url);");

    expect(/\bfetch\s*\(/.test(withComment)).toBe(true);
    expect(stripComments("// only a comment about fetch()\n")).not.toMatch(/\bfetch\s*\(/);
  });
});

/**
 * The labelling tool must not be able to see what the parser found.
 *
 * Ground truth seeded from parser output agrees with the parser by
 * construction, and every number the eval harness then reports is circular —
 * it would be measuring whether the parser agrees with itself. That property
 * lives in an import graph rather than in a person's discipline, so it is
 * asserted here alongside the network rule.
 *
 * The tool may use `src/criteria/normalize.ts`, so that labels and predictions
 * share a coordinate system. It may not reach `parse.ts` or any model.
 */
describe("the labelling tool cannot see the parser", () => {
  const LABEL_SCRIPT = fileURLToPath(new URL("../scripts/label-criteria.ts", import.meta.url));
  const modules = reachableModules(LABEL_SCRIPT);

  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) || file.endsWith(`criteria${sep}parse.ts`);

  it("walks a real graph", () => {
    expect(modules.length).toBeGreaterThanOrEqual(3);
    expect(modules.some((m) => m.endsWith(`criteria${sep}normalize.ts`))).toBe(true);
  });

  it("reaches neither the parser nor a model", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("reaches nothing that touches the network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);

    expect(offenders).toEqual([]);
  });

  // Proves the rule would fire. A check that cannot fail is not doing its job,
  // and this one guards the credibility of every number in the README.
  it("would catch an import of the parser or a model", () => {
    expect(forbidden("/src/criteria/parse.ts")).toBe(true);
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden("/src/criteria/normalize.ts")).toBe(false);
  });
});

/**
 * This repository's slice 0001: the search's labelling tools can't see the
 * search. Labels written knowing what the search keeps would agree with it by
 * construction, and the recall it reports would be circular. They may use the
 * text normalizer, a leaf module, so the dev pool's rule and the search read
 * text the same way. Nothing else under `src/search/`, and no model.
 */
describe("the search labelling tools cannot see the search", () => {
  const TOOLS = ["search-sample.ts", "search-show.ts"].map((name) =>
    fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)),
  );
  const modules = [...new Set(TOOLS.flatMap(reachableModules))];

  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    (file.includes(`${sep}search${sep}`) &&
      !file.endsWith(`search${sep}normalize.ts`) &&
      !file.includes(`${sep}evals${sep}search${sep}`));

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`trials${sep}snapshot-load.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`search${sep}normalize.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`evals${sep}search${sep}labels.ts`))).toBe(true);
  });

  it("reaches neither the search nor a model", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("reaches nothing that touches the network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("would catch an import of the search or a model", () => {
    expect(forbidden(`${sep}src${sep}search${sep}search.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}search${sep}vocabulary.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}search${sep}index.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}search${sep}normalize.ts`)).toBe(false);
    expect(forbidden(`${sep}evals${sep}search${sep}labels.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0005: the other-cancer labelling tool can't see the
 * check. It reads the search's vocabulary to know which trials are NSCLC
 * candidates, but labels written knowing what the check marks would agree
 * with it by construction. Not `src/search/other.ts`, and no model.
 */
describe("the other-cancer labelling tool cannot see the check", () => {
  const TOOL = fileURLToPath(new URL("../scripts/other-sample.ts", import.meta.url));
  const modules = reachableModules(TOOL);

  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) || file.endsWith(`src${sep}search${sep}other.ts`);

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`search${sep}vocabulary.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`evals${sep}search${sep}labels.ts`))).toBe(true);
  });

  it("reaches neither the check nor a model", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("reaches nothing that touches the network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("would catch an import of the check or a model", () => {
    expect(forbidden(`${sep}src${sep}search${sep}other.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}search${sep}vocabulary.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0002: the fact labelling tools can't see the
 * mapper. Labels written knowing what the mapper produced would agree with it
 * by construction. They may read the vocabulary and its types, nothing else
 * under `src/facts/`, and no model.
 */
describe("the facts labelling tools cannot see the mapper", () => {
  const TOOLS = ["facts-sample.ts", "facts-label-show.ts"].map((name) =>
    fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)),
  );
  const modules = [...new Set(TOOLS.flatMap(reachableModules))];

  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    (file.includes(`${sep}src${sep}facts${sep}`) &&
      !file.endsWith(`facts${sep}vocabulary.ts`) &&
      !file.endsWith(`facts${sep}types.ts`));

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`src${sep}facts${sep}vocabulary.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`evals${sep}facts${sep}labels.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`scripts${sep}label-criteria.ts`))).toBe(true);
  });

  it("reaches neither the mapper nor a model", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("reaches nothing that touches the network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("would catch an import of the mapper or a model", () => {
    expect(forbidden(`${sep}src${sep}facts${sep}map.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}facts${sep}index.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}facts${sep}vocabulary.ts`)).toBe(false);
    expect(forbidden(`${sep}src${sep}facts${sep}types.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0001: the search is arithmetic over registry data.
 * It reaches no model, no parser and no screening agent, so its results
 * don't depend on a model and its recall is measured on the search alone.
 */
describe("the search reaches no model, parser, screening agent or fact mapping", () => {
  const ENTRY = fileURLToPath(new URL("../src/search/index.ts", import.meta.url));
  const modules = reachableModules(ENTRY);
  // Slice 0002 added `facts`: the search stays independent of the mapping.
  const forbidden = (file: string): boolean =>
    [
      `${sep}models${sep}`,
      `${sep}criteria${sep}`,
      `${sep}screening${sep}`,
      `${sep}facts${sep}`,
    ].some((dir) => file.includes(dir));

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`search${sep}search.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`search${sep}vocabulary.ts`))).toBe(true);
  });

  it("reaches none of them", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("would catch one", () => {
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}screening${sep}session.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}facts${sep}status.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}trials${sep}snapshot-types.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0002: what a person's answers do to a trial is
 * arithmetic over committed mappings. The status function and the vocabulary
 * reach no model. The mapper takes its adapter as an argument, so no file
 * under `src/facts/` reaches the factory that builds one.
 */
describe("the fact status reaches no model, and src/facts/ builds none", () => {
  const facts = (name: string) => fileURLToPath(new URL(`../src/facts/${name}`, import.meta.url));
  const statusModules = [
    ...new Set(["status.ts", "vocabulary.ts"].map(facts).flatMap(reachableModules)),
  ];
  const allModules = [
    ...new Set(
      readdirSync(fileURLToPath(new URL("../src/facts/", import.meta.url)))
        .filter((n) => n.endsWith(".ts"))
        .map(facts)
        .flatMap(reachableModules),
    ),
  ];
  const isModel = (file: string): boolean => file.includes(`${sep}models${sep}`);
  const isFactory = (file: string): boolean =>
    file.endsWith(`models${sep}factory.ts`) || file.endsWith(`models${sep}index.ts`);

  it("walks a real graph", () => {
    expect(statusModules.some((m) => m.endsWith(`facts${sep}status.ts`))).toBe(true);
    expect(allModules.some((m) => m.endsWith(`facts${sep}types.ts`))).toBe(true);
    expect(allModules.some((m) => m.endsWith(`criteria${sep}locate.ts`))).toBe(true);
    expect(allModules.some((m) => m.endsWith(`models${sep}types.ts`))).toBe(true);
  });

  it("keeps the status function and vocabulary away from every model module", () => {
    expect(statusModules.filter(isModel)).toEqual([]);
  });

  it("keeps all of src/facts/ away from the factory", () => {
    expect(allModules.filter(isFactory)).toEqual([]);
  });

  it("would catch either", () => {
    expect(isModel(`${sep}src${sep}models${sep}types.ts`)).toBe(true);
    expect(isFactory(`${sep}src${sep}models${sep}factory.ts`)).toBe(true);
    expect(isFactory(`${sep}src${sep}models${sep}index.ts`)).toBe(true);
    expect(isFactory(`${sep}src${sep}models${sep}types.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0003: choosing a question, stopping, and ordering
 * the trials are pure functions. No model chooses, stops or orders. The one
 * part that reads a model's output, the reader (`read.ts`, `prompt.ts`),
 * takes its adapter as an argument, so nothing under `src/questions/` builds
 * one. The patients are checked before anything reads them.
 */
describe("question choice and the order reach no model", () => {
  const dirOf = (name: string) => fileURLToPath(new URL(`../src/${name}/`, import.meta.url));
  const filesIn = (name: string, except: readonly string[] = []) =>
    readdirSync(dirOf(name))
      .filter((n) => n.endsWith(".ts") && !except.includes(n))
      .map((n) => join(dirOf(name), n));
  const READER = ["read.ts", "prompt.ts"];
  const pure = [
    ...new Set(
      [...filesIn("shortlist"), ...filesIn("questions", [...READER, "index.ts"])].flatMap(
        reachableModules,
      ),
    ),
  ];
  const all = [...new Set(filesIn("questions").flatMap(reachableModules))];
  const patients = reachableModules(
    fileURLToPath(new URL("../evals/questions/patients.ts", import.meta.url)),
  );

  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    file.endsWith(`criteria${sep}parse.ts`) ||
    file.includes(`${sep}screening${sep}`) ||
    file.includes(`${sep}plain${sep}`) ||
    file.includes(`${sep}transport${sep}`);
  const isFactory = (file: string): boolean =>
    file.endsWith(`models${sep}factory.ts`) || file.endsWith(`models${sep}index.ts`);
  const isModel = (file: string): boolean => file.includes(`${sep}models${sep}`);

  it("walks a real graph", () => {
    expect(pure.some((m) => m.endsWith(`questions${sep}select.ts`))).toBe(true);
    expect(pure.some((m) => m.endsWith(`shortlist${sep}order.ts`))).toBe(true);
    expect(pure.some((m) => m.endsWith(`facts${sep}status.ts`))).toBe(true);
    expect(patients.some((m) => m.endsWith(`facts${sep}vocabulary.ts`))).toBe(true);
  });

  it("keeps the chooser, the conversation, the settings and the order away from models and agents", () => {
    expect(pure.filter(forbidden)).toEqual([]);
  });

  it("keeps all of src/questions/ away from the factory", () => {
    expect(all.filter(isFactory)).toEqual([]);
  });

  it("keeps the patient loader away from any model", () => {
    expect(patients.filter(isModel)).toEqual([]);
  });

  it("would catch each", () => {
    expect(forbidden(`${sep}src${sep}models${sep}types.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}screening${sep}agent.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}plain${sep}check.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}transport${sep}types.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}normalize.ts`)).toBe(false);
    expect(isFactory(`${sep}src${sep}models${sep}factory.ts`)).toBe(true);
    expect(isFactory(`${sep}src${sep}models${sep}fake.ts`)).toBe(false);
  });
});

/**
 * Slice 0004's two boundaries: the application cannot see the measurement, and
 * nothing outside `src/models/` chooses which model to call.
 *
 * Walked over every file under `src/` rather than a module graph, because both
 * are about what a file may name, not what it reaches.
 */
function allSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? allSourceFiles(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

/** Import specifiers that reach into `evals/`. */
function importsFromEvals(source: string): string[] {
  return [...stripComments(source).matchAll(/from\s+["']([^"']*evals\/[^"']*)["']/g)].flatMap(
    (m) => (m[1] === undefined ? [] : [m[1]]),
  );
}

/** The concrete adapter classes, which only the factory in `src/models/` may use as values. */
const ADAPTER_CLASSES = [
  "OmlxAdapter",
  "AnthropicAdapter",
  "AnthropicBatchAdapter",
  "OpenAIAdapter",
  "XaiAdapter",
  "FrontierChatAdapter",
] as const;

/** A value (not type-only) use of a concrete adapter. */
function usesConcreteAdapter(source: string): boolean {
  const code = stripTypeOnlyImports(stripComments(source));
  return ADAPTER_CLASSES.some((name) => new RegExp(`\\b${name}\\b`).test(code));
}

/** A value use of the factory that can build a frontier adapter. */
function usesFrontierFactory(source: string): boolean {
  return /\bcreateAdapter\b/.test(stripTypeOnlyImports(stripComments(source)));
}

/** A mention of a frontier provider's key variable. */
function namesKeyVariable(source: string): boolean {
  return /\b(ANTHROPIC_API_KEY|OPENAI_API_KEY|XAI_API_KEY)\b/.test(stripComments(source));
}

const SCRIPTS_DIR = fileURLToPath(new URL("../scripts", import.meta.url));

describe("the screening agent cannot see the measurement", () => {
  const files = allSourceFiles(SRC_DIR);

  it("walks every source file", () => {
    expect(files.some((f) => f.endsWith(`screening${sep}session.ts`))).toBe(true);
  });

  // Without this, "the agent never sees the vignette" rests on discipline.
  it("has no file under src/ importing from evals/", () => {
    const offenders = files.filter((f) => importsFromEvals(readFileSync(f, "utf8")).length > 0);
    expect(offenders).toEqual([]);
  });

  it("would catch an import from evals/", () => {
    expect(
      importsFromEvals('import { loadVignettes } from "../../evals/cases/vignettes.js";'),
    ).toEqual(["../../evals/cases/vignettes.js"]);
    expect(importsFromEvals('import { x } from "./apply.js";')).toEqual([]);
  });
});

describe("only src/models/ chooses a model", () => {
  const files = [...allSourceFiles(SRC_DIR), ...allSourceFiles(SCRIPTS_DIR)].filter(
    (f) => !isNetworkExempt(f),
  );

  it("walks the scripts as well as src/", () => {
    expect(files.some((f) => f.endsWith(`scripts${sep}fetch-trials.ts`))).toBe(true);
    expect(files.some((f) => f.endsWith(`scripts${sep}label-criteria.ts`))).toBe(true);
  });

  // The screening agent and the parser receive a ModelAdapter; neither can
  // construct one. Since slice 0008 the scripts can't either: they ask the
  // factory, so choosing a model is a command-line spec, never a code change.
  it("has no file outside src/models/ using a concrete adapter as a value", () => {
    const offenders = files.filter((f) => usesConcreteAdapter(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would catch one, and ignores a type-only mention", () => {
    expect(usesConcreteAdapter('import { OmlxAdapter } from "../models/index.js";')).toBe(true);
    expect(usesConcreteAdapter("const a = new OmlxAdapter();")).toBe(true);
    expect(usesConcreteAdapter("const a = new AnthropicAdapter({ model });")).toBe(true);
    expect(usesConcreteAdapter('import type { OmlxAdapter } from "../models/index.js";')).toBe(
      false,
    );
    expect(usesConcreteAdapter("// never construct an OmlxAdapter here")).toBe(false);
  });
});

/**
 * Slice 0008: `createAdapter` builds frontier adapters, for scripts a person
 * runs with `--spend`. Code under `src/` takes an adapter it is handed, so
 * nothing there outside `src/models/` names that factory. A running
 * application, when one exists, gets its adapter from `createLocalAdapter` or
 * `createAppAdapter`, and the slice that adds it pins which file may.
 */
/** The running app's factory, and the one file that may name it (slice 0004). */
const APP_MODELS = `${sep}src${sep}server${sep}models.ts`;
const E2E_DIR = fileURLToPath(new URL("../e2e", import.meta.url));

function usesAppFactory(source: string): boolean {
  return /\bcreateAppAdapter\b/.test(stripTypeOnlyImports(stripComments(source)));
}

/**
 * Slice 0004: the page reaches a hosted provider only when a person chose
 * one in Settings and saved a key there, through `createAppAdapter`, which
 * always wraps it in the budget, and only from the one server file that
 * builds the app's models. Naming `createAdapter` would be the way around
 * both, so it's forbidden everywhere the app runs. Copied from the
 * prescreening repository.
 */
describe("the running application reaches a hosted provider only through Settings", () => {
  const APP_FILES = [
    ...allSourceFiles(resolve(SRC_DIR, "server")),
    ...allSourceFiles(resolve(SRC_DIR, "transport")),
    ...allSourceFiles(resolve(SRC_DIR, "web")),
    resolve(SCRIPTS_DIR, "app.ts"),
    ...(existsSync(E2E_DIR) ? allSourceFiles(E2E_DIR) : []),
  ];

  it("covers the page, the server, the transport and the app launcher", () => {
    expect(APP_FILES.some((f) => f.endsWith(`server${sep}finder.ts`))).toBe(true);
    expect(APP_FILES.some((f) => f.endsWith(`scripts${sep}app.ts`))).toBe(true);
  });

  it("never names the factory that builds frontier adapters", () => {
    expect(APP_FILES.filter((f) => usesFrontierFactory(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("names the app's factory only in the server file that builds the app's models", () => {
    const naming = [...allSourceFiles(SRC_DIR), ...allSourceFiles(SCRIPTS_DIR)].filter(
      (f) => !isNetworkExempt(f) && usesAppFactory(readFileSync(f, "utf8")),
    );
    expect(naming.map((f) => f.slice(f.indexOf(`${sep}src${sep}`)))).toEqual([APP_MODELS]);
  });

  it("would catch the app's factory named anywhere else", () => {
    expect(usesAppFactory('import { createAppAdapter } from "../models/index.js";')).toBe(true);
    expect(usesAppFactory("// createAppAdapter lives in src/server/models.ts")).toBe(false);
  });
});

describe("the application tree never builds a frontier adapter", () => {
  const files = allSourceFiles(SRC_DIR).filter((f) => !isNetworkExempt(f));

  it("walks src/ outside the models module", () => {
    expect(files.some((f) => f.endsWith(`screening${sep}session.ts`))).toBe(true);
  });

  it("never names the factory that builds frontier adapters", () => {
    const offenders = files.filter((f) => usesFrontierFactory(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would catch it", () => {
    expect(usesFrontierFactory('import { createAdapter } from "../src/models/index.js";')).toBe(
      true,
    );
    expect(usesFrontierFactory("createLocalAdapter(spec)")).toBe(false);
    expect(usesFrontierFactory('import type { createAdapter } from "./x.js";')).toBe(false);
  });
});

/**
 * Slice 0008: a provider's key is read in one file. Anywhere else, a script
 * holding a key's value is one `console.log` from printing it.
 */
describe("keys are read in one place", () => {
  const KEYS_FILE = `${sep}models${sep}keys.ts`;

  it("names the key variables only in src/models/keys.ts", () => {
    const naming = [...allSourceFiles(SRC_DIR), ...allSourceFiles(SCRIPTS_DIR)].filter((f) =>
      namesKeyVariable(readFileSync(f, "utf8")),
    );
    expect(naming.map((f) => f.slice(f.lastIndexOf(`${sep}models${sep}`)))).toEqual([KEYS_FILE]);
  });

  it("would catch a script reading one", () => {
    expect(namesKeyVariable('const key = process.env["ANTHROPIC_API_KEY"];')).toBe(true);
    expect(namesKeyVariable("// ANTHROPIC_API_KEY lives in .env")).toBe(false);
  });
});

/**
 * Slice 0005's transport boundary: nothing outside `src/transport/` knows how
 * messages are delivered (CLAUDE.md). Asserted over source, like the others.
 */
function importsFrom(source: string, dir: string): string[] {
  const code = stripComments(source);
  return [...code.matchAll(/from\s+["']([^"']+)["']/g)].flatMap((m) =>
    m[1]?.includes(`/${dir}/`) ? [m[1]] : [],
  );
}

describe("only src/transport/ knows how messages are delivered", () => {
  const files = allSourceFiles(SRC_DIR);

  it("keeps the conversation agent ignorant of transports and servers", () => {
    const screening = files.filter((f) => f.includes(`${sep}screening${sep}`));
    expect(screening.length).toBeGreaterThanOrEqual(8);
    const offenders = screening.filter((f) => {
      const code = readFileSync(f, "utf8");
      return importsFrom(code, "transport").length > 0 || importsFrom(code, "server").length > 0;
    });
    expect(offenders).toEqual([]);
  });

  // Anthropic's endpoint is `/v1/messages`, a provider's URL rather than this
  // app's route, and it lives in `src/models/` under that directory's own
  // named-host rule. Excluded by directory, so a route leaking into any other
  // file is still caught (slice 0008).
  it("names the message routes only in the transport's routes and its browser client", () => {
    const naming = files.filter(
      (f) =>
        !isNetworkExempt(f) &&
        /\/(messages|retry)[`"']/.test(stripComments(readFileSync(f, "utf8"))),
    );
    expect(naming.map((f) => f.slice(SRC_DIR.length)).sort()).toEqual([
      `${sep}transport${sep}web${sep}client.ts`,
      `${sep}transport${sep}web${sep}routes.ts`,
    ]);
  });

  it("would catch a violation", () => {
    expect(importsFrom('import { x } from "../transport/index.js";', "transport")).toHaveLength(1);
    expect(
      importsFrom(
        stripTypeOnlyImports('import type { X } from "../transport/index.js";'),
        "transport",
      ),
    ).toEqual([]);
  });
});

/**
 * Slice 0006's boundary: plain language is display only (spec D2). The agent
 * asks and reads from the protocol's words, so 0004's numbers still describe
 * it. Without this, "the agent never sees a rendering" rests on discipline.
 */
describe("the agent cannot see a plain-language rendering", () => {
  const files = allSourceFiles(SRC_DIR);
  const screening = files.filter((f) => f.includes(`${sep}screening${sep}`));

  it("has no file under src/screening/ importing from src/plain/", () => {
    expect(screening.length).toBeGreaterThanOrEqual(8);
    const offenders = screening.filter(
      (f) => importsFrom(readFileSync(f, "utf8"), "plain").length > 0,
    );
    expect(offenders).toEqual([]);
  });

  it("gives the agent's criterion exactly four fields, none of them a rendering", () => {
    const types = readFileSync(resolve(SRC_DIR, "screening", "types.ts"), "utf8");
    expect(interfaceFields(types, "ScreeningCriterion")).toEqual([
      "id",
      "polarity",
      "type",
      "text",
    ]);
  });

  it("would catch either", () => {
    expect(importsFrom('import { displayFor } from "../plain/index.js";', "plain")).toHaveLength(1);
    expect(
      interfaceFields(
        "export interface ScreeningCriterion {\n  id: string;\n  text: string;\n  plain?: string;\n}",
        "ScreeningCriterion",
      ),
    ).toEqual(["id", "text", "plain"]);
  });
});

/** The field names of an interface, in order, from its source. */
function interfaceFields(source: string, name: string): string[] {
  const body = stripComments(source).match(
    new RegExp(`interface\\s+${name}\\s*\\{([^}]*)\\}`),
  )?.[1];
  if (body === undefined) {
    throw new Error(`no interface ${name}`);
  }
  return [...body.matchAll(/^\s*(\w+)\??\s*:/gm)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
}

/**
 * Test files share a module cache (`isolate: false` in vitest.config.ts, slice
 * 0006). That is safe only while no test replaces a module or a global, since
 * the replacement would leak into whichever file runs next in the worker.
 */
function replacesShared(source: string): boolean {
  return /\bvi\.(mock|doMock|stubGlobal|stubEnv|spyOn|useFakeTimers)\s*\(/.test(
    stripComments(source),
  );
}

describe("tests can share modules", () => {
  const TESTS_DIR = fileURLToPath(new URL(".", import.meta.url));
  const testFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      return entry.isDirectory() ? testFiles(path) : path.endsWith(".test.ts") ? [path] : [];
    });

  it("has no test replacing a module or a global", () => {
    const files = testFiles(TESTS_DIR);
    expect(files.length).toBeGreaterThanOrEqual(40);
    // This file is left out: its own proofs below are strings that name the calls.
    const others = files.filter((f) => !f.endsWith(`${sep}boundary.test.ts`));
    expect(others.filter((f) => replacesShared(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("would catch one", () => {
    expect(replacesShared('vi.mock("../src/models/omlx.js");')).toBe(true);
    expect(replacesShared("vi.spyOn(console, 'log');")).toBe(true);
    expect(replacesShared("const x = new FakeModelAdapter();")).toBe(false);
  });
});

/**
 * Slice 0004: the page runs in a browser. Its tsconfig sees Node's types only
 * so it can import the server's response types, which makes this the check
 * that nothing Node-only slipped into browser code. Copied from the
 * prescreening repository.
 */
function usesNode(source: string): boolean {
  const code = stripTypeOnlyImports(stripComments(source));
  return /from\s+["']node:/.test(code) || /\bprocess\./.test(code);
}

describe("the page is browser code", () => {
  const files = allSourceFiles(resolve(SRC_DIR, "web"));

  it("walks the page's files", () => {
    expect(files.some((f) => f.endsWith("main.tsx"))).toBe(true);
  });

  it("imports no Node module and reads no process state", () => {
    expect(files.filter((f) => usesNode(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("is imported by nothing else under src/", () => {
    const WEB_DIR = resolve(SRC_DIR, "web") + sep;
    const intoWeb = (file: string) =>
      [...stripComments(readFileSync(file, "utf8")).matchAll(/from\s+["'](\.[^"']+)["']/g)].some(
        (m) => resolve(dirname(file), m[1] ?? "").startsWith(WEB_DIR),
      );
    const offenders = allSourceFiles(SRC_DIR).filter((f) => !f.startsWith(WEB_DIR) && intoWeb(f));
    expect(offenders).toEqual([]);
  });

  it("would catch either, and ignores a type-only import", () => {
    expect(usesNode('import { readFileSync } from "node:fs";')).toBe(true);
    expect(usesNode("const key = process.env.KEY;")).toBe(true);
    expect(usesNode('import type { X } from "node:fs";')).toBe(false);
  });
});

/**
 * Slice 0004: the browser test runs the page with the scripted reader, so
 * `npm run test:e2e` can never reach a model, local or hosted. Copied from
 * the prescreening repository.
 */
const PLAYWRIGHT_CONFIG = fileURLToPath(new URL("../playwright.config.ts", import.meta.url));

/** The `command:` string in Playwright's config, or "" if there is none. */
function webServerCommand(config: string): string {
  const m = /\bcommand:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/.exec(stripComments(config));
  return m?.[1] ?? m?.[2] ?? m?.[3] ?? "";
}

/** Whether a command runs the app with the scripted reader and names no model. */
function runsScriptedReaderOnly(command: string): boolean {
  return /\s--fake\b/.test(command) && !/--(model|spend|reader|provider)\b/.test(command);
}

describe("the browser test reaches no model", () => {
  it("starts its server with the scripted reader and no model flag", () => {
    const command = webServerCommand(readFileSync(PLAYWRIGHT_CONFIG, "utf8"));
    expect(command).toContain("npm run app");
    expect(runsScriptedReaderOnly(command)).toBe(true);
  });

  it("would catch a browser test given a model", () => {
    expect(runsScriptedReaderOnly("npm run app -- --fake --port 5035")).toBe(true);
    expect(runsScriptedReaderOnly("npm run app -- --port 5035")).toBe(false);
    expect(runsScriptedReaderOnly("npm run app -- --fake --model omlx")).toBe(false);
    expect(runsScriptedReaderOnly("npm run app -- --fake --spend")).toBe(false);
  });
});

/**
 * This repository's slice 0007: the deeper check. The link, what it carries
 * and the record are pure: no model, no parser. Nothing under `src/check/`
 * builds an adapter (it's passed one) or knows about the page, the transport
 * or the server. The screening agent receives what the conversation carried
 * as its own type, so it reaches neither `src/check/` nor the fact mapper,
 * and still not `src/plain/`.
 */
describe("the check's link and record reach no model, and src/check/ builds none", () => {
  const dir = fileURLToPath(new URL("../src/check/", import.meta.url));
  const check = (name: string) => join(dir, name);
  const pure = [
    ...new Set(["link.ts", "carry.ts", "record.ts"].map(check).flatMap(reachableModules)),
  ];
  const all = [
    ...new Set(
      readdirSync(dir)
        .filter((n) => n.endsWith(".ts"))
        .map(check)
        .flatMap(reachableModules),
    ),
  ];
  const screeningDir = fileURLToPath(new URL("../src/screening/", import.meta.url));
  const screening = [
    ...new Set(
      readdirSync(screeningDir)
        .filter((n) => n.endsWith(".ts"))
        .map((n) => join(screeningDir, n))
        .flatMap(reachableModules),
    ),
  ];

  const isModelOrParser = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) || file.endsWith(`criteria${sep}parse.ts`);
  const isFactoryOrApp = (file: string): boolean =>
    file.endsWith(`models${sep}factory.ts`) ||
    file.endsWith(`models${sep}index.ts`) ||
    [`${sep}web${sep}`, `${sep}transport${sep}`, `${sep}server${sep}`].some((d) =>
      file.includes(`${sep}src${d}`),
    );
  const beyondTheAgent = (file: string): boolean =>
    [`${sep}check${sep}`, `${sep}facts${sep}`, `${sep}plain${sep}`].some((d) =>
      file.includes(`${sep}src${d}`),
    );

  it("walks a real graph", () => {
    expect(pure.some((m) => m.endsWith(`check${sep}record.ts`))).toBe(true);
    expect(pure.some((m) => m.endsWith(`shortlist${sep}words.ts`))).toBe(true);
    expect(all.some((m) => m.endsWith(`criteria${sep}parse.ts`))).toBe(true);
    expect(all.some((m) => m.endsWith(`screening${sep}session.ts`))).toBe(true);
    expect(screening.some((m) => m.endsWith(`screening${sep}apply.ts`))).toBe(true);
  });

  it("keeps the link, what it carries and the record away from every model module and the parser", () => {
    expect(pure.filter(isModelOrParser)).toEqual([]);
  });

  it("keeps all of src/check/ away from the factory, the page, the transport and the server", () => {
    expect(all.filter(isFactoryOrApp)).toEqual([]);
  });

  it("keeps the screening agent away from src/check/, the mapper and src/plain/", () => {
    expect(screening.filter(beyondTheAgent)).toEqual([]);
  });

  it("would catch each", () => {
    expect(isModelOrParser(`${sep}src${sep}models${sep}types.ts`)).toBe(true);
    expect(isModelOrParser(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(isModelOrParser(`${sep}src${sep}criteria${sep}locate.ts`)).toBe(false);
    expect(isFactoryOrApp(`${sep}src${sep}models${sep}index.ts`)).toBe(true);
    expect(isFactoryOrApp(`${sep}src${sep}server${sep}models.ts`)).toBe(true);
    expect(isFactoryOrApp(`${sep}src${sep}transport${sep}types.ts`)).toBe(true);
    expect(isFactoryOrApp(`${sep}src${sep}web${sep}copy.ts`)).toBe(true);
    expect(isFactoryOrApp(`${sep}src${sep}models${sep}types.ts`)).toBe(false);
    expect(beyondTheAgent(`${sep}src${sep}check${sep}link.ts`)).toBe(true);
    expect(beyondTheAgent(`${sep}src${sep}facts${sep}types.ts`)).toBe(true);
    expect(beyondTheAgent(`${sep}src${sep}plain${sep}index.ts`)).toBe(true);
    expect(beyondTheAgent(`${sep}src${sep}screening${sep}apply.ts`)).toBe(false);
  });
});

/**
 * This repository's slice 0007: the pair labels say what a trial's text and
 * a patient's file say, written before anything reads the trial. The tool
 * that shows a pair can run the conversation (to know the picks), but can't
 * reach the parser, the link, the screening agent or a model.
 */
describe("the pair labelling tool cannot see the parser, the link or the agent", () => {
  const SCRIPT = fileURLToPath(new URL("../scripts/check-label-show.ts", import.meta.url));
  const modules = reachableModules(SCRIPT);
  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    file.endsWith(`criteria${sep}parse.ts`) ||
    file.includes(`${sep}src${sep}check${sep}`) ||
    file.includes(`${sep}src${sep}screening${sep}`);

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`check${sep}pairs.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`questions${sep}conversation.ts`))).toBe(true);
  });

  it("reaches none of them", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("would catch each", () => {
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}check${sep}link.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}screening${sep}session.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}normalize.ts`)).toBe(false);
  });
});

/**
 * Slice 0008: the benchmarks' files are downloaded by a person into `local/`,
 * and the import reads them from there. So nothing the import reaches touches
 * the network, the registry request or a model. The download URLs are named in
 * `evals/benchmark/sources.ts` as data, for the manifest, and never fetched:
 * this asserts the fetch, not the name.
 */
describe("the benchmark import reaches no network, registry or model", () => {
  const SCRIPT = fileURLToPath(new URL("../scripts/benchmark-import.ts", import.meta.url));
  const modules = reachableModules(SCRIPT);
  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) || file.endsWith(REGISTRY_FILE);

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`benchmark${sep}sources.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`benchmark${sep}trec-xml.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`benchmark${sep}trialbench.ts`))).toBe(true);
  });

  it("touches no network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("reaches no model and not the registry request", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("would catch each", () => {
    expect(forbidden(`${sep}src${sep}models${sep}omlx.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}trials${sep}registry.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}trials${sep}snapshot-types.ts`)).toBe(false);
    expect(
      findNetworkUsage(`${sep}evals${sep}benchmark${sep}sources.ts`, "await fetch(url);"),
    ).toEqual(["fetch()"]);
  });
});

/**
 * Slice 0009: `benchmark:lines` prints a result's lines and re-assembles a
 * record from stored findings. It reads; it never checks. So it reaches no
 * model module, not the parser, not the agent's session and no network.
 */
describe("benchmark:lines reaches no model, parser, session or network", () => {
  const SCRIPT = fileURLToPath(new URL("../scripts/benchmark-lines.ts", import.meta.url));
  const modules = reachableModules(SCRIPT);
  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    file.endsWith(`${sep}criteria${sep}parse.ts`) ||
    file.endsWith(`${sep}screening${sep}session.ts`) ||
    file.endsWith(`${sep}screening${sep}calls.ts`);

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`check${sep}record.ts`))).toBe(true);
    expect(modules.some((m) => m.endsWith(`screening${sep}from-parse.ts`))).toBe(true);
  });

  it("touches no network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("reaches none of them", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("would catch each", () => {
    expect(forbidden(`${sep}src${sep}models${sep}types.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}screening${sep}session.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}check${sep}record.ts`)).toBe(false);
  });
});

/**
 * Slice 0010: `criteria:compare` reads two sets of parse files and prints how
 * they differ. It never parses, so it reaches no model module, not the parser,
 * not the parse cache and no network.
 */
describe("criteria:compare reaches no model, parser, parse cache or network", () => {
  const SCRIPT = fileURLToPath(new URL("../scripts/criteria-compare.ts", import.meta.url));
  const modules = reachableModules(SCRIPT);
  const forbidden = (file: string): boolean =>
    file.includes(`${sep}models${sep}`) ||
    file.endsWith(`${sep}criteria${sep}parse.ts`) ||
    file.endsWith(`${sep}check${sep}parse-cache.ts`);

  it("walks a real graph", () => {
    expect(modules.some((m) => m.endsWith(`scripts${sep}criteria-compare.ts`))).toBe(true);
  });

  it("touches no network", () => {
    const offenders = modules
      .map((file) => ({ file, usage: findNetworkUsage(file) }))
      .filter(({ usage }) => usage.length > 0);
    expect(offenders).toEqual([]);
  });

  it("reaches none of them", () => {
    expect(modules.filter(forbidden)).toEqual([]);
  });

  it("would catch each", () => {
    expect(forbidden(`${sep}src${sep}models${sep}types.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}parse.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}check${sep}parse-cache.ts`)).toBe(true);
    expect(forbidden(`${sep}src${sep}criteria${sep}types.ts`)).toBe(false);
  });
});

/**
 * Slice 0011: the page names no address off this machine. The fetch rule
 * above reads scripts only; a stylesheet's `@import` or `url()`, or a `<link>`
 * in `index.html`, would load a font or a script from a CDN past it. The fonts
 * and icons are bundled under `src/web/` instead.
 */
const WEB_DIR = fileURLToPath(new URL("../src/web", import.meta.url));
const TEXT_EXTENSIONS = /\.(css|html|svg|ts|tsx|webmanifest|json)$/;

function webFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return webFiles(path);
    return TEXT_EXTENSIONS.test(entry.name) ? [path] : [];
  });
}

/** The http(s) addresses in a file, leaving out XML namespace declarations. */
function outsideAddresses(source: string): string[] {
  const withoutNamespaces = source.replace(/\bxmlns(?::[\w-]+)?="[^"]*"/g, "");
  return [...withoutNamespaces.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]);
}

describe("the page names no outside address", () => {
  it("in any stylesheet, page, icon, manifest or component under src/web/", () => {
    const files = webFiles(WEB_DIR);
    expect(files.some((f) => f.endsWith("styles.css"))).toBe(true);
    expect(files.some((f) => f.endsWith("index.html"))).toBe(true);
    const found = files.flatMap((f) =>
      outsideAddresses(readFileSync(f, "utf8")).map((a) => `${relative(WEB_DIR, f)}: ${a}`),
    );
    expect(found).toEqual([]);
  });

  it("would catch a font loaded from a CDN, and pass an SVG's namespace", () => {
    expect(
      outsideAddresses('@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans");'),
    ).toEqual(["https://fonts.googleapis.com/css2?family=IBM+Plex+Sans"]);
    expect(outsideAddresses('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">')).toEqual(
      [],
    );
  });
});
