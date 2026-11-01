import { describe, expect, it } from "vitest";
import { parseableTrialOf } from "../../evals/benchmark/trialbench.js";
import { trialsForSet } from "../../scripts/benchmark-parse.js";

describe("the check's trials, as the parser takes them", () => {
  it("keep the release's criteria verbatim, and say nothing the release doesn't", () => {
    const t = parseableTrialOf({
      nctId: "NCT00000001",
      briefTitle: "A trial",
      conditions: ["Cervical Cancer"],
      phases: ["PHASE1"],
      minimumAge: "18 Years",
      maximumAge: null,
      sex: "ALL",
      criteriaText: "1\\. Inclusion Criteria:\n\n* Age 18",
    });
    expect(t.eligibility).toEqual({
      criteriaText: "1\\. Inclusion Criteria:\n\n* Age 18",
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: null,
      healthyVolunteers: null,
      stdAges: [],
    });
  });

  it("are dev's 12 and held-out's 30 more, 42 in all", () => {
    const dev = trialsForSet("dev").map((t) => t.nctId);
    const heldout = trialsForSet("heldout").map((t) => t.nctId);
    expect(dev).toHaveLength(12);
    expect(new Set([...dev, ...heldout]).size).toBe(42);
    expect(heldout.filter((id) => !dev.includes(id))).toHaveLength(30);
  });
});
