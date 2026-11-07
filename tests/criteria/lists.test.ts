import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCriteria } from "../../src/criteria/index.js";
import { settleLists } from "../../src/criteria/parse.js";
import type { Criterion, ParsedCriteria } from "../../src/criteria/types.js";
import { readAnyOf } from "../../src/criteria/validate.js";
import { FakeModelAdapter } from "../../src/models/index.js";
import { fromParse } from "../../src/screening/from-parse.js";
import { getTrial } from "../../src/trials/index.js";

/**
 * List marks (spec 0010 §2): a shared `anyOf` label on the items of a list the
 * trial accepts any one of, and the code that drops a mark it can't trust.
 * Criteria below are made up; only their shape matters.
 */

function item(id: string, overrides: Partial<Criterion> = {}): Criterion {
  return {
    id,
    polarity: "inclusion",
    type: "clinical",
    text: `The participant has condition ${id}`,
    source: { start: 0, end: 1, text: id },
    confidence: null,
    ...overrides,
  };
}

describe("settleLists", () => {
  it("keeps a list of two or more inclusions for the same people", () => {
    const { criteria, dropped } = settleLists([
      item("a", { anyOf: "kind" }),
      item("b", { anyOf: "kind" }),
      item("c"),
    ]);
    expect(dropped).toEqual([]);
    expect(criteria.map((c) => c.anyOf)).toEqual(["kind", "kind", undefined]);
  });

  it.each([
    {
      name: "one item",
      items: [item("a", { anyOf: "x" }), item("b")],
      reason: "a list needs two or more items",
    },
    {
      name: "mixed polarity",
      items: [item("a", { anyOf: "x" }), item("b", { anyOf: "x", polarity: "exclusion" })],
      reason: "items differ in polarity",
    },
    {
      name: "different parts",
      items: [item("a", { anyOf: "x", appliesTo: "Arm A" }), item("b", { anyOf: "x" })],
      reason: "items differ in the part they're for",
    },
    {
      name: "exclusions only",
      items: [
        item("a", { anyOf: "x", polarity: "exclusion" }),
        item("b", { anyOf: "x", polarity: "exclusion" }),
      ],
      reason: "an exclusion list already reads right split",
    },
  ])("drops the mark on $name, and says why", ({ items, reason }) => {
    const { criteria, dropped } = settleLists(items);
    expect(dropped).toEqual([
      { label: "x", ids: items.filter((c) => c.anyOf).map((c) => c.id), reason },
    ]);
    expect(criteria.every((c) => !("anyOf" in c))).toBe(true);
    expect(criteria).toHaveLength(items.length);
  });
});

describe("readAnyOf", () => {
  it("reads a label, and treats absent or blank as none", () => {
    const problems: string[] = [];
    expect(readAnyOf(" kind ", problems)).toBe("kind");
    expect(readAnyOf(null, problems)).toBeNull();
    expect(readAnyOf(undefined, problems)).toBeNull();
    expect(readAnyOf("  ", problems)).toBeNull();
    expect(problems).toEqual([]);
  });

  it("calls anything else a fault", () => {
    const problems: string[] = [];
    expect(readAnyOf(3, problems)).toBeNull();
    expect(problems).toEqual(["anyOf 3 is not a string"]);
  });
});

describe("parseCriteria with marks", () => {
  // Two quotes that occur in this real fixture, in document order.
  const TRIAL = getTrial("NCT04316364");
  const FIRST = "Eastern Cooperative Oncology Group (ECOG) performance status 0 or 1";
  const SECOND =
    "Women of childbearing age without sterilizing or male, must agree to use contraception";
  const entry = (quote: string, anyOf: unknown) => ({
    quote,
    text: quote,
    polarity: "inclusion",
    type: "clinical",
    confidence: 0.9,
    anyOf,
  });

  it("carries a valid mark onto each item", async () => {
    const parsed = await parseCriteria(
      TRIAL,
      new FakeModelAdapter([
        { kind: "json", content: { criteria: [entry(FIRST, "pair"), entry(SECOND, "pair")] } },
      ]),
    );
    expect(parsed.criteria.map((c) => c.anyOf)).toEqual(["pair", "pair"]);
    expect(parsed).not.toHaveProperty("droppedMarks");
  });

  it("drops a lone mark and records it", async () => {
    const parsed = await parseCriteria(
      TRIAL,
      new FakeModelAdapter([
        { kind: "json", content: { criteria: [entry(FIRST, "solo"), entry(SECOND, null)] } },
      ]),
    );
    expect(parsed.criteria.some((c) => "anyOf" in c)).toBe(false);
    expect(parsed.droppedMarks?.map((d) => d.reason)).toEqual(["a list needs two or more items"]);
  });
});

describe("a parse made before marks", () => {
  const DIR = fileURLToPath(
    new URL("../../data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2", import.meta.url),
  );
  const file = readdirSync(DIR).find((f) => f.startsWith("NCT02211755-")) as string;
  const parsed = JSON.parse(readFileSync(join(DIR, file), "utf8")) as ParsedCriteria;

  it("loads with no marks and no dropped marks", () => {
    expect(parsed.criteria.some((c) => c.anyOf !== undefined)).toBe(false);
    expect(parsed.droppedMarks).toBeUndefined();
  });

  it("gives the agent the same four fields", () => {
    const { criteria } = fromParse(parsed);
    expect(criteria.every((c) => Object.keys(c).sort().join() === "id,polarity,text,type")).toBe(
      true,
    );
  });
});
