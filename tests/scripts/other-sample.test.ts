import { describe, expect, it } from "vitest";
import { drawSets, type ShortlistRow } from "../../scripts/other-sample.js";
import { loadVocabulary } from "../../src/search/vocabulary.js";
import { trial } from "../search/trial-fixture.js";

/** Made-up trials and short lists. Nothing here is a real study or patient. */
const vocabulary = loadVocabulary("nsclc");
const lung = (id: string) => trial(id, { conditions: ["Non-Small Cell Lung Cancer"] });
const ids = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => `NCT${String(from + i).padStart(8, "0")}`);

const trials = [
  ...ids(1, 30).map(lung),
  trial("NCT90000001", { conditions: ["Prostate Cancer"] }),
  trial("NCT90000002", {
    conditions: ["Non-Small Cell Lung Cancer"],
    primaryPurpose: "SUPPORTIVE_CARE",
  }),
];
const rows: ShortlistRow[] = [
  { set: "dev", shortlist: ["NCT00000001", "NCT00000002"] },
  { set: "heldout", shortlist: ["NCT00000002", "NCT00000003", "NCT00000004"] },
  { set: "heldout", shortlist: ["NCT00000005"] },
];

describe("drawSets", () => {
  it("splits short-list trials by whether a dev patient's list holds them", () => {
    const sets = drawSets(trials, vocabulary, rows, new Set(), 5);
    expect(sets.placesDev).toEqual(["NCT00000001", "NCT00000002"]);
    expect(sets.placesHeldout).toEqual(["NCT00000003", "NCT00000004", "NCT00000005"]);
  });

  it("leaves out trials already labelled, from every set", () => {
    const labelled = new Set(["NCT00000002", "NCT00000004", "NCT00000006"]);
    const sets = drawSets(trials, vocabulary, rows, labelled, 30);
    const all = [...sets.placesDev, ...sets.placesHeldout, ...sets.sample];
    expect(all.filter((id) => labelled.has(id))).toEqual([]);
  });

  it("draws the sample from NSCLC candidates only, and shares no trial between sets", () => {
    const sets = drawSets(trials, vocabulary, rows, new Set(), 100);
    expect(sets.sample).toHaveLength(25);
    expect(sets.sample).not.toContain("NCT90000001");
    expect(sets.sample).not.toContain("NCT90000002");
    const all = [...sets.placesDev, ...sets.placesHeldout, ...sets.sample];
    expect(new Set(all).size).toBe(all.length);
  });

  it("draws the same sample whatever the input order", () => {
    const a = drawSets(trials, vocabulary, rows, new Set(), 10);
    const b = drawSets([...trials].reverse(), vocabulary, [...rows].reverse(), new Set(), 10);
    expect(a).toEqual(b);
    expect(a.sample).toHaveLength(10);
  });
});
