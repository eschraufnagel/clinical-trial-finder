import { describe, expect, it } from "vitest";
import type { TrialStatus } from "../../src/facts/status.js";
import type { FactMapping } from "../../src/facts/types.js";
import type { Candidate } from "../../src/search/types.js";
import {
  ORDER_KEYS,
  ORDER_NAMES,
  ORDERS,
  type OrderEntry,
  orderTrials,
  shortlistOf,
} from "../../src/shortlist/order.js";

const MAPPING: FactMapping = {
  factId: "ecog",
  rulesOut: ["ps2"],
  polarity: "inclusion",
  source: { start: 0, end: 8, text: "ECOG 0-1" },
};

function entry(
  nctId: string,
  miles: number | null,
  hints = 0,
  partHints = 0,
  mapped = true,
  fits = 0,
): OrderEntry {
  const candidate: Candidate = {
    nctId,
    briefTitle: nctId,
    phases: ["PHASE2"],
    reasons: ["names"],
    nearestSite: { facility: null, city: null, state: null, miles },
    flags: [],
  };
  const status: TrialStatus = {
    nctId,
    hints: Array.from({ length: hints }, () => MAPPING),
    partHints: Array.from({ length: partHints }, () => ({ ...MAPPING, appliesTo: "Part B" })),
    fits: Array.from({ length: fits }, (_, i) => `fact${i}`),
    unknown: [],
  };
  return { candidate, status: mapped ? status : null };
}

const ids = (order: readonly OrderEntry[]) => order.map((e) => e.candidate.nctId);

describe("orderTrials", () => {
  it("pins its keys, in order", () => {
    expect(ORDER_KEYS).toEqual(["wholeTrialHints", "partHints", "miles", "nctId"]);
  });

  it("puts fewer whole-trial hints first, whatever the distance", () => {
    expect(ids(orderTrials([entry("NCT2", 5, 1), entry("NCT1", 90, 0)]))).toEqual(["NCT1", "NCT2"]);
  });

  it("then fewer part hints", () => {
    expect(ids(orderTrials([entry("NCT2", 5, 1, 2), entry("NCT1", 90, 1, 0)]))).toEqual([
      "NCT1",
      "NCT2",
    ]);
  });

  it("then the nearest site, with no distance last", () => {
    expect(ids(orderTrials([entry("NCT3", null), entry("NCT2", 40), entry("NCT1", 10)]))).toEqual([
      "NCT1",
      "NCT2",
      "NCT3",
    ]);
  });

  it("then the id, including between two with no distance", () => {
    expect(ids(orderTrials([entry("NCT9", null), entry("NCT1", null), entry("NCT5", 7)]))).toEqual([
      "NCT5",
      "NCT1",
      "NCT9",
    ]);
  });

  it("sorts a trial with no mappings as unhinted", () => {
    expect(ids(orderTrials([entry("NCT1", 5, 1), entry("NCT2", 50, 0, 0, false)]))).toEqual([
      "NCT2",
      "NCT1",
    ]);
  });

  it("drops nothing, and doesn't change its input", () => {
    const input = [entry("NCT3", 3, 4), entry("NCT1", 1, 2), entry("NCT2", 2)];
    const order = orderTrials(input);
    expect(order).toHaveLength(3);
    expect(ids(input)).toEqual(["NCT3", "NCT1", "NCT2"]);
  });
});

describe("the orders of slice 0004", () => {
  it("pins every order's keys, all with whole-trial hints first", () => {
    expect(ORDERS).toEqual({
      hints: ["wholeTrialHints", "partHints", "miles", "nctId"],
      checked: ["wholeTrialHints", "partHints", "checked", "miles", "nctId"],
      "read-first": ["wholeTrialHints", "partHints", "unread", "miles", "nctId"],
    });
    expect(ORDER_KEYS).toBe(ORDERS.hints);
  });

  it("checked: more facts checked first among equal hints, never above a trial with fewer", () => {
    const near = entry("NCT1", 1, 0, 0, true, 1);
    const far = entry("NCT2", 90, 0, 0, true, 5);
    const hinted = entry("NCT3", 2, 1, 0, true, 9);
    const unread = entry("NCT4", 0, 0, 0, false);
    expect(ids(orderTrials([near, far, hinted, unread], "checked"))).toEqual([
      "NCT2",
      "NCT1",
      "NCT4",
      "NCT3",
    ]);
    expect(ids(orderTrials([near, far, hinted, unread]))).toEqual(["NCT4", "NCT1", "NCT2", "NCT3"]);
  });

  it("read-first: trials with mappings before trials with none, among equal hints", () => {
    const notInRun = entry("NCT1", 1, 0, 0, false);
    const read = entry("NCT2", 50, 0, 0, true, 1);
    const hinted = entry("NCT3", 2, 1);
    // In the run, but no rule of it mapped onto a fact: no fits, no unknowns.
    const noRules = entry("NCT4", 1);
    expect(ids(orderTrials([notInRun, read, hinted, noRules], "read-first"))).toEqual([
      "NCT2",
      "NCT1",
      "NCT4",
      "NCT3",
    ]);
  });

  it("drops nothing, under any order", () => {
    const input = [entry("NCT3", 3, 4), entry("NCT1", 1, 2, 0, false), entry("NCT2", 2, 0, 1)];
    for (const name of ORDER_NAMES) expect(orderTrials(input, name)).toHaveLength(3);
  });
});

describe("shortlistOf", () => {
  it("is the top of the order, or all of it when there are fewer", () => {
    const order = orderTrials([entry("NCT1", 1), entry("NCT2", 2), entry("NCT3", 3)]);
    expect(ids(shortlistOf(order, 2))).toEqual(["NCT1", "NCT2"]);
    expect(ids(shortlistOf(order, 10))).toEqual(["NCT1", "NCT2", "NCT3"]);
  });
});
