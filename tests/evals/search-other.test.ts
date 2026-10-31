import { describe, expect, it } from "vitest";
import {
  type PlacesRow,
  passesBar,
  placesHeld,
  type RouteRow,
  scoreRoutes,
  summarizePlaces,
} from "../../evals/search/other.js";

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

describe("scoreRoutes", () => {
  const r = (nctId: string, relevant: boolean, routes: string[], unclear = false): RouteRow => ({
    nctId,
    set: "sample",
    relevant,
    unclear,
    routes,
  });
  const rows = [
    r("NCT00000001", false, ["listing"]),
    r("NCT00000002", false, []),
    r("NCT00000003", true, ["rules"]),
    r("NCT00000004", true, ["rules"], true),
    r("NCT00000005", true, []),
  ];

  it("scores each route on its own, and any route together", () => {
    const [listing, rules, any] = scoreRoutes(rows, ["listing", "rules"]);
    expect(listing).toEqual({
      route: "listing",
      markedNotRelevant: ["NCT00000001"],
      markedRelevant: [],
      markedRelevantUnclear: [],
      unmarkedNotRelevant: ["NCT00000002"],
    });
    expect(rules?.markedRelevant).toEqual(["NCT00000003"]);
    expect(rules?.markedRelevantUnclear).toEqual(["NCT00000004"]);
    expect(any?.markedNotRelevant).toEqual(["NCT00000001"]);
    expect(any?.unmarkedNotRelevant).toEqual(["NCT00000002"]);
  });

  it("passes the bar with no relevant trial marked and at most one unclear one", () => {
    const [listing, rules] = scoreRoutes(rows, ["listing", "rules"]);
    expect(passesBar(listing as never)).toBe(true);
    expect(passesBar(rules as never)).toBe(false);
    const [onlyUnclear] = scoreRoutes([rows[3] as RouteRow], ["rules"]);
    expect(passesBar(onlyUnclear as never)).toBe(true);
    const [twoUnclear] = scoreRoutes(
      [rows[3] as RouteRow, { ...(rows[3] as RouteRow), nctId: "NCT00000006" }],
      ["rules"],
    );
    expect(passesBar(twoUnclear as never)).toBe(false);
  });
});
