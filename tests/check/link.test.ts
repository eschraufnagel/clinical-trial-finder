import { describe, expect, it } from "vitest";
import { LINK_THRESHOLD, linkCriteria, overlap } from "../../src/check/link.js";
import type { Criterion, SourceSpan } from "../../src/criteria/types.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";

/**
 * The link decides which parsed rules the conversation already covered. It
 * has no model, so its edges are pinned here: the threshold, several facts on
 * one rule, none, and spans that don't come from the trial's own text.
 */

const TEXT =
  "Inclusion: Age 18 or older. No prior immunotherapy or targeted therapy. " +
  "Exclusion: Untreated brain metastases. Pregnant or breastfeeding.";

function span(quote: string): SourceSpan {
  const start = TEXT.indexOf(quote);
  if (start < 0) throw new Error(`not in text: ${quote}`);
  return { start, end: start + quote.length, text: quote };
}

function criterion(quote: string): Criterion {
  const source = span(quote);
  return {
    id: `NCT00000001:${source.start}-${source.end}`,
    polarity: "inclusion",
    type: "patient",
    text: quote,
    source,
    confidence: null,
  };
}

const mapping = (factId: string, quote: string, rulesOut = ["yes"]): FactMapping => ({
  factId,
  rulesOut,
  polarity: "exclusion",
  source: span(quote),
});

const facts = (mappings: FactMapping[]): TrialFacts => ({
  nctId: "NCT00000001",
  mappings,
  rejected: [],
  run: {
    model: "fake",
    quantization: "none",
    temperature: 0,
    seed: 0,
    adapter: "fake",
    promptVersion: "x",
    timestamp: "2000-06",
    vocabularySha256: "x",
    normalizeVersion: "2",
    snapshotMonth: "2000-06",
    cancerType: "nsclc",
  },
});

function ids(...criteria: Criterion[]): Map<Criterion, string> {
  return new Map(criteria.map((c, i) => [c, `P${i + 1}`]));
}

describe("overlap", () => {
  it("is shared characters over the shorter span", () => {
    expect(overlap({ start: 0, end: 10, text: "" }, { start: 5, end: 25, text: "" })).toBe(0.5);
    expect(overlap({ start: 0, end: 10, text: "" }, { start: 10, end: 20, text: "" })).toBe(0);
    expect(overlap({ start: 2, end: 4, text: "" }, { start: 0, end: 100, text: "" })).toBe(1);
  });
});

describe("linkCriteria", () => {
  it("links a criterion split out of a longer mapped passage", () => {
    const c = criterion("No prior immunotherapy");
    const links = linkCriteria(
      "NCT00000001",
      TEXT,
      ids(c),
      facts([mapping("prior_pd1", "No prior immunotherapy or targeted therapy.")]),
    );
    expect(links.get("P1")?.map((l) => l.factId)).toEqual(["prior_pd1"]);
  });

  it("links at the threshold and not under it", () => {
    // The criterion is 20 characters; a mapping sharing exactly 10 of them is at 0.5.
    const quote = "Untreated brain meta";
    const c = criterion(quote);
    const start = TEXT.indexOf(quote);
    const at: FactMapping = {
      factId: "brain_mets",
      rulesOut: ["untreated"],
      polarity: "exclusion",
      source: { start: start + 10, end: start + 40, text: TEXT.slice(start + 10, start + 40) },
    };
    const under: FactMapping = {
      ...at,
      source: { start: start + 11, end: start + 40, text: TEXT.slice(start + 11, start + 40) },
    };
    expect(LINK_THRESHOLD).toBe(0.5);
    expect(linkCriteria("NCT00000001", TEXT, ids(c), facts([at])).get("P1")).toHaveLength(1);
    expect(linkCriteria("NCT00000001", TEXT, ids(c), facts([under])).get("P1")).toEqual([]);
  });

  it("links every fact whose passage covers the criterion", () => {
    const c = criterion("No prior immunotherapy or targeted therapy.");
    const links = linkCriteria(
      "NCT00000001",
      TEXT,
      ids(c),
      facts([
        mapping("prior_pd1", "No prior immunotherapy or targeted therapy."),
        mapping("prior_targeted", "No prior immunotherapy or targeted therapy.", ["received"]),
      ]),
    );
    expect(links.get("P1")?.map((l) => l.factId)).toEqual(["prior_pd1", "prior_targeted"]);
    expect(links.get("P1")?.[1]?.rulesOut).toEqual(["received"]);
  });

  it("gives every criterion an entry, empty when nothing covers it", () => {
    const a = criterion("Age 18 or older.");
    const b = criterion("Pregnant or breastfeeding.");
    const links = linkCriteria(
      "NCT00000001",
      TEXT,
      ids(a, b),
      facts([mapping("pregnant_or_breastfeeding", "Pregnant or breastfeeding.")]),
    );
    expect(links.get("P1")).toEqual([]);
    expect(links.get("P2")).toHaveLength(1);
  });

  it("links nothing when the trial has no mappings", () => {
    const links = linkCriteria("NCT00000001", TEXT, ids(criterion("Age 18 or older.")), undefined);
    expect(links.get("P1")).toEqual([]);
  });

  it("refuses spans that don't come from the trial's text", () => {
    const c = criterion("Age 18 or older.");
    const elsewhere: FactMapping = {
      factId: "ecog",
      rulesOut: ["ps3"],
      polarity: "inclusion",
      source: { start: 0, end: 9, text: "ECOG 0-1." },
    };
    expect(() => linkCriteria("NCT00000001", TEXT, ids(c), facts([elsewhere]))).toThrow(
      /Cannot link NCT00000001/,
    );
  });
});
