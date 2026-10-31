import { describe, expect, it } from "vitest";
import { asRecorded, settingsForCheck, withOrder } from "../../scripts/questions-eval.js";
import { SETTINGS } from "../questions/fixture.js";

/**
 * `questions:eval -- --check` reruns a committed result as it was made. A dev
 * result made before Gate 2 froze the settings must rerun under its own
 * settings, not today's, or the check fails on a result nothing is wrong with.
 */
describe("settingsForCheck", () => {
  it("reruns a result under the settings it records, with their checksum", () => {
    const { sha256, ...recorded } = { ...SETTINGS, budget: 10, sha256: "1".repeat(64) };
    const current = { ...SETTINGS, budget: 8, sha256: "2".repeat(64) };
    const settings = settingsForCheck({ settings: recorded, settingsSha256: sha256 }, current);
    expect(settings.budget).toBe(10);
    expect(settings.sha256).toBe("1".repeat(64));
  });
});

describe("asRecorded", () => {
  it("keeps only the keys a committed result has, all the way down", () => {
    const rerun = { a: 1, b: { c: 2, d: 3 }, rows: [{ x: 1, y: 2 }], extra: true };
    const committed = { a: 1, b: { c: 2 }, rows: [{ x: 1 }] };
    expect(asRecorded(rerun, committed)).toEqual(committed);
  });

  it("still shows a difference in a recorded field", () => {
    expect(asRecorded({ a: 2, extra: 1 }, { a: 1 })).toEqual({ a: 2 });
  });
});

describe("withOrder", () => {
  it("leaves the committed order's settings alone, and renames any other", () => {
    expect(withOrder(SETTINGS, "hints")).toBe(SETTINGS);
    const checked = withOrder(SETTINGS, "checked");
    expect(checked.order).toBe("checked");
    expect(checked.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checked.sha256).not.toBe(SETTINGS.sha256);
    expect(withOrder(SETTINGS, "checked").sha256).toBe(checked.sha256);
  });

  it("reruns a result under the order it records, and a result with none under hints", () => {
    const { sha256, ...recorded } = withOrder(SETTINGS, "read-first");
    expect(settingsForCheck({ settings: recorded, settingsSha256: sha256 }, SETTINGS).order).toBe(
      "read-first",
    );
    const { order: _order, ...old } = recorded;
    expect(settingsForCheck({ settings: old, settingsSha256: sha256 }, SETTINGS).order).toBe(
      "hints",
    );
  });
});
