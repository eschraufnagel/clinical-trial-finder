import { describe, expect, it } from "vitest";
import { type PlacesRow, placesHeld, summarizePlaces } from "../../evals/search/other.js";

/** Made-up short lists and labels. Nothing here is a real patient. */
const row = (patient: string, set: string, shortlist: string[], scorer: string | null = null) =>
  ({
    patient,
    set,
    arm: scorer === null ? "record" : "conversation",
    scorer,
    shortlist,
  }) as PlacesRow;

const labels = [
  { nctId: "NCT00000001", relevant: true },
  { nctId: "NCT00000002", relevant: false },
  { nctId: "NCT00000003", relevant: false },
  { nctId: "NCT00000004", relevant: null },
];

describe("placesHeld", () => {
  it("counts places held by trials labelled not relevant, in short-list order", () => {
    const [held] = placesHeld(
      [row("p1", "heldout", ["NCT00000003", "NCT00000001", "NCT00000002"])],
      labels,
    );
    expect(held?.places).toBe(3);
    expect(held?.notRelevant).toEqual(["NCT00000003", "NCT00000002"]);
    expect(held?.unlabelled).toEqual([]);
  });

  it("counts a trial with no label, or an empty one, as unlabelled, never as not relevant", () => {
    const [held] = placesHeld([row("p1", "heldout", ["NCT00000004", "NCT00000009"])], labels);
    expect(held?.notRelevant).toEqual([]);
    expect(held?.unlabelled).toEqual(["NCT00000004", "NCT00000009"]);
  });
});

describe("summarizePlaces", () => {
  it("sums by set, arm and scorer, and counts patients with any", () => {
    const held = placesHeld(
      [
        row("p1", "heldout", ["NCT00000001", "NCT00000002"]),
        row("p2", "heldout", ["NCT00000001"]),
        row("p1", "heldout", ["NCT00000002", "NCT00000003"], "shortlist"),
        row("p3", "dev", ["NCT00000003"]),
      ],
      labels,
    );
    expect(summarizePlaces(held)).toEqual([
      {
        set: "heldout",
        arm: "record",
        scorer: null,
        patients: 2,
        places: 3,
        notRelevant: 1,
        patientsWithAny: 1,
        unlabelled: 0,
      },
      {
        set: "heldout",
        arm: "conversation",
        scorer: "shortlist",
        patients: 1,
        places: 2,
        notRelevant: 2,
        patientsWithAny: 1,
        unlabelled: 0,
      },
      {
        set: "dev",
        arm: "record",
        scorer: null,
        patients: 1,
        places: 1,
        notRelevant: 1,
        patientsWithAny: 1,
        unlabelled: 0,
      },
    ]);
  });
});
