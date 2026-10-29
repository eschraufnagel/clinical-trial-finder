import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadAllTrialFacts } from "../../src/questions/trials.js";
import { mapping, trialFacts } from "./fixture.js";

describe("loadAllTrialFacts", () => {
  const dir = mkdtempSync(join(tmpdir(), "trial-facts-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads every trial's mappings in a run, and nothing else in it", () => {
    writeFileSync(join(dir, "NCT01.json"), JSON.stringify(trialFacts("NCT01", [])));
    writeFileSync(
      join(dir, "NCT02.json"),
      JSON.stringify(trialFacts("NCT02", [mapping("hiv", ["uncontrolled"])])),
    );
    writeFileSync(join(dir, "manifest.json"), "{}");
    writeFileSync(join(dir, "failures.json"), "[]");
    const all = loadAllTrialFacts(dir);
    expect([...all.keys()].sort()).toEqual(["NCT01", "NCT02"]);
    expect(all.get("NCT02")?.mappings[0]?.factId).toBe("hiv");
  });
});
