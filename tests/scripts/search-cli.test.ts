import { describe, expect, it } from "vitest";
import { formatResult, parseArgs } from "../../scripts/search.js";
import type { SearchResult } from "../../src/search/types.js";

const RESULT: SearchResult = {
  snapshot: { month: "2000-06", dataTimestamp: "2000-06-15T09:00:05" },
  request: {
    cancerType: "nsclc",
    age: 64,
    sex: "female",
    zip: "62701",
    radiusMiles: 50,
    purposes: ["TREATMENT"],
  },
  funnel: [
    { stage: "snapshot", count: 5740 },
    { stage: "purpose", count: 4241 },
    { stage: "cancer", count: 1200 },
    { stage: "age-and-sex", count: 1190 },
    { stage: "distance", count: 2 },
  ],
  candidates: [
    {
      nctId: "NCT00000001",
      briefTitle: "Made-up trial",
      phases: ["PHASE1", "PHASE2"],
      reasons: ["names", "rules"],
      nearestSite: {
        facility: "Example Hospital",
        city: "Springfield",
        state: "Illinois",
        miles: 3,
      },
      flags: ["stale-record"],
    },
    {
      nctId: "NCT00000002",
      briefTitle: "Made-up trial",
      phases: [],
      reasons: ["generic"],
      nearestSite: { facility: null, city: "Peoria", state: "Illinois", miles: null },
      flags: ["site-distance-unknown", "past-completion"],
    },
  ],
};

describe("formatResult", () => {
  const text = formatResult(RESULT, "non-small cell lung cancer");

  it("prints the funnel with each stage in words", () => {
    expect(text).toMatch(/^Snapshot 2000-06: 5,740 trials \(registry data of 2000-06-15\)/);
    expect(text).toMatch(/treatment trials\s+4,241/);
    expect(text).toMatch(/for non-small cell lung cancer\s+1,200/);
    expect(text).toMatch(/open to a 64-year-old female\s+1,190/);
    expect(text).toMatch(
      /recruiting within 50 miles\s+2 {3}\(of these: names it 1 · mentions it in its rules 1 · open to many 1\)/,
    );
  });

  it("prints a row per trial with phase, reasons, distance and flags", () => {
    expect(text).toMatch(
      /NCT00000001 {2}Phase 1\/Phase 2 +3 mi {2}Example Hospital, Springfield Illinois {2}· names it, mentions it in its rules {2}\[record not updated in over a year\]/,
    );
    expect(text).toMatch(
      /NCT00000002 {2}— +\? mi {2}Peoria Illinois {2}· open to many {2}\[nearest site has no location; completion date has passed\]/,
    );
  });

  it("says when the distance is anywhere", () => {
    expect(
      formatResult({ ...RESULT, request: { ...RESULT.request, radiusMiles: null } }, "x"),
    ).toMatch(/recruiting anywhere in the US/);
  });
});

describe("parseArgs", () => {
  const base = ["--cancer", "nsclc", "--zip", "60611", "--age", "64", "--sex", "female"];

  it("reads a request with a 100-mile default and treatment trials only", () => {
    expect(parseArgs(base)).toEqual({
      request: {
        cancerType: "nsclc",
        zip: "60611",
        age: 64,
        sex: "female",
        radiusMiles: 100,
        purposes: ["TREATMENT"],
      },
      json: false,
    });
    const wide = parseArgs([...base, "--miles", "anywhere", "--purpose", "all", "--json"]);
    expect(wide.request.radiusMiles).toBeNull();
    expect(wide.request.purposes).toBe("all");
    expect(wide.json).toBe(true);
  });

  it("names every problem at once", () => {
    expect(() => parseArgs(["--age", "old", "--sex", "x", "--miles", "-3"])).toThrow(
      /--cancer is required[\s\S]*--zip is required[\s\S]*--age must be[\s\S]*--sex must be[\s\S]*--miles must be/,
    );
  });
});
