import { describe, expect, it } from "vitest";
import { settingsForCheck } from "../../scripts/questions-eval.js";
import { SETTINGS } from "../questions/fixture.js";

/**
 * `questions:eval -- --check` reruns a committed result as it was made. A dev
 * result made before Gate 2 froze the settings must rerun under its own
 * settings, not today's, or the check fails on a result nothing is wrong with.
 */
describe("settingsForCheck", () => {
  // Fails until --check reruns under the recorded settings: the fix flips it to it.
  it.fails("reruns a result under the settings it records, with their checksum", () => {
    const { sha256, ...recorded } = { ...SETTINGS, budget: 10, sha256: "1".repeat(64) };
    const current = { ...SETTINGS, budget: 8, sha256: "2".repeat(64) };
    const settings = settingsForCheck({ settings: recorded, settingsSha256: sha256 }, current);
    expect(settings.budget).toBe(10);
    expect(settings.sha256).toBe("1".repeat(64));
  });
});
