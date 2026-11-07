import { describe, expect, it } from "vitest";
import {
  compareSets,
  compareTrial,
  estimateLists,
  formatComparison,
  type ParseFile,
} from "../../scripts/criteria-compare.js";

/** Made-up parses of a made-up trial; nothing here is from a real record. */
type Spec = {
  id: string;
  quote: string;
  type?: "patient" | "clinical";
  polarity?: "inclusion" | "exclusion";
  anyOf?: string;
};

function parse(nctId: string, items: Spec[], extra: Partial<ParseFile> = {}): ParseFile {
  return {
    nctId,
    criteria: items.map((s) => ({
      id: s.id,
      polarity: s.polarity ?? "inclusion",
      type: s.type ?? "clinical",
      text: `The participant: ${s.quote}`,
      source: { start: 0, end: s.quote.length, text: s.quote },
      confidence: null,
      ...(s.anyOf === undefined ? {} : { anyOf: s.anyOf }),
    })),
    rejected: [],
    unclaimed: [],
    run: {} as ParseFile["run"],
    ...extra,
  };
}

describe("compareTrial", () => {
  const OLD = parse("NCT00000009", [
    { id: "a", quote: "Has blue eyes and green hair" },
    { id: "b", quote: "Wears glasses" },
    { id: "c", quote: "Owns a bicycle" },
    { id: "d", quote: "Is left-handed", type: "patient" },
  ]);
  const NEW = parse(
    "NCT00000009",
    [
      { id: "a1", quote: "Has blue eyes" },
      { id: "a2", quote: "green hair" },
      { id: "b", quote: "Wears glasses", anyOf: "sight" },
      { id: "d", quote: "Is left-handed", type: "clinical" },
    ],
    { droppedMarks: [{ label: "solo", ids: ["d"], reason: "a list needs two or more items" }] },
  );
  const t = compareTrial(OLD, NEW);

  it("lists a split, a loss and a changed type", () => {
    expect(t.matched).toBe(2);
    expect(t.onlyOld.map((c) => c.id)).toEqual(["a", "c"]);
    expect(t.onlyNew.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(t.changed).toEqual([{ id: "d", field: "type", old: "patient", new: "clinical" }]);
  });

  it("lists a new mark and a dropped one", () => {
    expect(t.lists).toEqual([{ label: "sight", quotes: ["Wears glasses"] }]);
    expect(t.dropped).toEqual([{ label: "solo", reason: "a list needs two or more items" }]);
  });

  it("names a join from the other side", () => {
    const joined = compareTrial(NEW, OLD);
    expect(joined.onlyNew.map((c) => c.id)).toEqual(["a", "c"]);
  });
});

describe("compareSets", () => {
  it("compares trials on both sides and names the rest", () => {
    const r = compareSets(
      [parse("NCT00000001", [{ id: "x", quote: "q" }]), parse("NCT00000002", [])],
      [parse("NCT00000001", [{ id: "x", quote: "q" }]), parse("NCT00000003", [])],
    );
    expect(r.trials.map((t) => t.nctId)).toEqual(["NCT00000001"]);
    expect(r.onlyOld).toEqual(["NCT00000002"]);
    expect(r.onlyNew).toEqual(["NCT00000003"]);
    expect(formatComparison(r)).toContain("Totals over 1 trials: 1 matched");
  });
});

describe("estimateLists", () => {
  it("counts an 'or' pair and a lead-in with three items", () => {
    const e = estimateLists([
      parse("NCT00000001", [
        { id: "1", quote: "Has a red kite, or" },
        { id: "2", quote: "has a yellow kite." },
        { id: "3", quote: "Has one of these kites:" },
        { id: "4", quote: "box kite" },
        { id: "5", quote: "delta kite" },
        { id: "6", quote: "sled kite" },
      ]),
      parse("NCT00000002", [{ id: "1", quote: "Is over 18" }]),
    ]);
    expect(e).toEqual({ trials: 2, trialsWithLists: 1, orRuns: 1, leadInRuns: 1 });
  });
});
