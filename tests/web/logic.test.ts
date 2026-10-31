import { describe, expect, it } from "vitest";
import { CHECK_WORDS, MAX_CHECKED } from "../../src/server/check.js";
import { CONFIRM, WORDS } from "../../src/server/finder.js";
import {
  asksToChoose,
  formatUsd,
  hashOf,
  isConfirm,
  MAX_TICKED,
  routeFrom,
  toggleTick,
} from "../../src/web/logic.js";

describe("the page's routes", () => {
  it("read every view from the hash, and write it back the same", () => {
    for (const route of [
      { view: "start" },
      { view: "settings" },
      { view: "conversation", id: "c1" },
      { view: "list", id: "c1" },
      { view: "sheet", id: "c1" },
      { view: "check", id: "c1", check: "k1" },
    ] as const) {
      expect(routeFrom(hashOf(route))).toEqual(route);
    }
    expect(routeFrom("")).toEqual({ view: "start" });
    expect(routeFrom("#/list/")).toEqual({ view: "start" });
    expect(routeFrom("#/nonsense")).toEqual({ view: "start" });
    expect(routeFrom("#/check/c1/")).toEqual({ view: "start" });
  });
});

describe("isConfirm", () => {
  it("knows the server's confirm step from a question's answers", () => {
    expect(isConfirm(CONFIRM)).toBe(true);
    expect(isConfirm([{ id: "no" }, { id: "unknown" }])).toBe(false);
    expect(isConfirm(undefined)).toBe(false);
  });
});

describe("formatUsd", () => {
  it("shows cents, or tenths of a cent under a cent", () => {
    expect(formatUsd(0.1)).toBe("$0.10");
    expect(formatUsd(0.0078)).toBe("$0.008");
  });
});

describe("asksToChoose", () => {
  it("knows every message of the server's that asks the person to choose, and no question", () => {
    for (const text of [WORDS.closest, WORDS.unclear, WORDS.unavailable, WORDS.capped]) {
      expect(asksToChoose(text)).toBe(true);
    }
    expect(asksToChoose(WORDS.unavailableBecause("No key saved for Anthropic."))).toBe(true);
    expect(asksToChoose("Has the cancer spread to the brain?")).toBe(false);
  });

  it("knows the check's too (slice 0007)", () => {
    for (const text of [
      CHECK_WORDS.choose,
      CHECK_WORDS.unclear,
      CHECK_WORDS.unavailable,
      CHECK_WORDS.capped,
      CHECK_WORDS.tapsOnly,
      CHECK_WORDS.unavailableBecause("No key."),
    ]) {
      expect(asksToChoose(text)).toBe(true);
    }
  });
});

describe("toggleTick (slice 0007)", () => {
  it("ticks and unticks, and refuses a fourth, as the server does", () => {
    expect(MAX_TICKED).toBe(MAX_CHECKED);
    let ticked = toggleTick([], "A");
    ticked = toggleTick(toggleTick(ticked, "B"), "C");
    expect(ticked).toEqual(["A", "B", "C"]);
    expect(toggleTick(ticked, "D")).toEqual(["A", "B", "C"]);
    expect(toggleTick(ticked, "B")).toEqual(["A", "C"]);
  });
});
