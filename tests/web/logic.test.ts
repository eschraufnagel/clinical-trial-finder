import { describe, expect, it } from "vitest";
import { CONFIRM, WORDS } from "../../src/server/finder.js";
import { asksToChoose, formatUsd, hashOf, isConfirm, routeFrom } from "../../src/web/logic.js";

describe("the page's routes", () => {
  it("read every view from the hash, and write it back the same", () => {
    for (const route of [
      { view: "start" },
      { view: "settings" },
      { view: "conversation", id: "c1" },
      { view: "list", id: "c1" },
      { view: "sheet", id: "c1" },
    ] as const) {
      expect(routeFrom(hashOf(route))).toEqual(route);
    }
    expect(routeFrom("")).toEqual({ view: "start" });
    expect(routeFrom("#/list/")).toEqual({ view: "start" });
    expect(routeFrom("#/nonsense")).toEqual({ view: "start" });
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
});
