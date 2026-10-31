import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHECK_WORDS, READING_WORDS, TAPS } from "../../src/server/check.js";
import { CONFIRM, WORDS } from "../../src/server/finder.js";
import { verdictHits } from "../../src/shortlist/words.js";
import { COPY } from "../../src/web/copy.js";

/**
 * Never a verdict on the page (spec 0004 §7). Every fixed sentence is in
 * `src/web/copy.ts` or the server's own words, and is scanned here; any word
 * written straight into a component fails, so the scan can't be gone around.
 */
const WEB_DIR = fileURLToPath(new URL("../../src/web/", import.meta.url));

/** Every string in a copy table, calling each function with a sample argument. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String((value as (...a: unknown[]) => unknown)("x", 1))];
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

/** JSX text with a letter in it, written in the component rather than drawn from a table. */
function jsxWords(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...code.matchAll(/>([^<>{}()=;]*[A-Za-z][^<>{}()=;]*)</g)]
    .map((m) => (m[1] ?? "").trim())
    .filter((t) => t.length > 0);
}

describe("the page's words", () => {
  it("state no verdict, in the page's copy or the conversation's and the check's own messages", () => {
    const all = [
      ...strings(COPY),
      ...strings(WORDS),
      ...CONFIRM.map((c) => c.label),
      ...strings(CHECK_WORDS),
      ...strings(READING_WORDS),
      ...TAPS.map((c) => c.label),
    ];
    expect(all.length).toBeGreaterThan(60);
    expect(verdictHits(all)).toEqual([]);
  });

  it("are never written straight into a component", () => {
    const files = readdirSync(WEB_DIR).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(5);
    const found = files.flatMap((f) =>
      jsxWords(readFileSync(join(WEB_DIR, f), "utf8")).map((t) => `${f}: ${t}`),
    );
    expect(found).toEqual([]);
  });

  it("would catch a word written into a component", () => {
    expect(jsxWords("<p>You are eligible</p>")).toEqual(["You are eligible"]);
    expect(jsxWords("<p>{COPY.title}</p>")).toEqual([]);
    expect(jsxWords("const x = useState<Route>(() => route(hash));\nuseState<Info>()")).toEqual([]);
  });
});
