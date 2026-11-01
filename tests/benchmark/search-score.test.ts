import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  rate,
  scoreTrec,
  scoreTrecNote,
  scoreTrialBench,
  summarize,
  vocabulariesHash,
} from "../../evals/benchmark/search-score.js";
import type { TrecJudgment } from "../../evals/benchmark/trec.js";
import { loadZipPoints } from "../../src/search/geo.js";
import { loadVocabulary } from "../../src/search/vocabulary.js";
import { trial } from "../search/trial-fixture.js";

const breast = loadVocabulary("breast");
const limits = (minimumAge: string | null, maximumAge: string | null) => ({
  eligibility: { ...trial("x").eligibility, minimumAge, maximumAge },
});
const trials = [
  trial("NCT00000001", { conditions: ["Breast Cancer"] }),
  trial("NCT00000002", { conditions: ["Prostate Cancer"] }),
  trial("NCT00000003", { conditions: ["Breast Cancer"], ...limits("18 Years", "40 Years") }),
  trial("NCT00000004", { conditions: ["Breast Cancer"], primaryPurpose: "SUPPORTIVE_CARE" }),
  trial("NCT00000005", { conditions: ["Advanced Solid Tumors"] }),
];
const judgments: TrecJudgment[] = [
  { topic: "2021-25", nctId: "NCT00000001", judgment: 2 },
  { topic: "2021-25", nctId: "NCT00000002", judgment: 1 },
  { topic: "2021-25", nctId: "NCT00000003", judgment: 2 },
  { topic: "2021-25", nctId: "NCT00000004", judgment: 0 },
  { topic: "2021-25", nctId: "NCT00000005", judgment: 1 },
];
const profile = { age: 42, sex: "female" as const };

describe("scoreTrecNote", () => {
  const rows = scoreTrecNote("2021-25", trials, judgments, profile, breast);
  const row = (id: string) => rows.find((r) => r.nctId === id);

  it("keeps every purpose, and says where each dropped trial left", () => {
    expect(row("NCT00000001")).toMatchObject({ kept: true, droppedAt: null, reasons: ["names"] });
    expect(row("NCT00000002")).toMatchObject({ kept: false, droppedAt: "cancer", reasons: [] });
    expect(row("NCT00000003")).toMatchObject({ kept: false, droppedAt: "age-and-sex" });
    expect(row("NCT00000004")).toMatchObject({ kept: true });
    expect(row("NCT00000005")).toMatchObject({ kept: true, reasons: ["generic"] });
  });

  it("refuses a judged trial with no record", () => {
    expect(() => scoreTrecNote("2021-25", [], judgments, profile, breast)).toThrow(/has no trial/);
  });

  it("summarizes judgments 1 and 2 as the headline, and 0 apart", () => {
    const s = summarize("2021-25", rows);
    expect(s.relevant).toEqual(rate(2, 4));
    expect(s.eligible).toEqual(rate(1, 2));
    expect(s.notRelevant).toEqual(rate(1, 1));
    expect(s.byReason).toEqual({ names: 1, rules: 0, generic: 1 });
    expect(s.droppedAtAgeOrSex).toEqual(["2021-25 NCT00000003"]);
    expect(s.misses).toEqual(["2021-25 NCT00000002", "2021-25 NCT00000003"]);
  });
});

describe("scoreTrec", () => {
  it("pools the notes and groups them by type", () => {
    const result = scoreTrec({
      trials,
      judgments: [...judgments, { topic: "2021-61", nctId: "NCT00000001", judgment: 2 }],
      profiles: [
        { year: "2021", number: 25, cancerType: "breast", age: 42, sex: "female" },
        { year: "2021", number: 61, cancerType: "breast", age: 45, sex: "female" },
      ],
      vocabularies: new Map([["breast", breast]]),
      sources: {},
    });
    expect(result.byNote.map((s) => s.name)).toEqual(["2021-25", "2021-61"]);
    expect(result.byType).toHaveLength(1);
    expect(result.pooled.relevant).toEqual(rate(3, 5));
    expect(result.model).toBeNull();
  });

  it("names the result by its vocabularies, in any order", () => {
    expect(vocabulariesHash({ a: "1", b: "2" })).toBe(vocabulariesHash({ b: "2", a: "1" }));
    expect(vocabulariesHash({ a: "1" })).not.toBe(vocabulariesHash({ a: "2" }));
  });
});

describe("scoreTrialBench", () => {
  const zips = loadZipPoints(
    fileURLToPath(new URL("../search/fixtures/zips.csv", import.meta.url)),
  );
  const zip = [...zips.keys()][0] as string;
  const snapshotTrials = [
    trial("NCT10000001", { conditions: ["Advanced Solid Tumors"] }),
    trial("NCT10000002", { conditions: ["Prostate Cancer"] }),
    trial("NCT10000003", { conditions: ["Breast Cancer"], primaryPurpose: "DIAGNOSTIC" }),
  ];
  const result = scoreTrialBench({
    snapshot: {
      trials: snapshotTrials,
      manifest: { month: "2000-06", dataTimestamp: "2000-06-15" },
    },
    zipPoints: zips,
    vignettes: [
      { patient: "nci-01", ic: "NCI", targetTrial: "NCT10000001", summary: "" },
      { patient: "nci-02", ic: "NCI", targetTrial: "NCT10000002", summary: "" },
      { patient: "nci-03", ic: "NCI", targetTrial: "NCT19999999", summary: "" },
    ],
    profiles: ["nci-01", "nci-02", "nci-03"].map((patient) => ({
      patient,
      cancerType: "breast",
      age: 50,
      sex: "female" as const,
    })),
    labels: [
      { patient: "nci-01", nctId: "NCT10000003", label: "recommended", comment: "" },
      { patient: "nci-01", nctId: "NCT19999998", label: "ineligible", comment: "" },
    ],
    vocabularies: new Map([["breast", breast]]),
    others: new Map(),
    sources: {},
    notes: {},
    zip,
  });

  it("keeps a basket target by the generic route, and says where the others left", () => {
    expect(result.targets.map((t) => [t.nctId, t.droppedAt])).toEqual([
      ["NCT10000001", null],
      ["NCT10000002", "cancer"],
      ["NCT19999999", "not-in-snapshot"],
    ]);
    expect(result.summary.targetKept).toEqual(rate(1, 2));
    expect(result.summary.byReason).toEqual({ names: 0, rules: 0, generic: 1 });
    expect(result.summary.targetsNotInSnapshot).toEqual(["NCT19999999"]);
  });

  it("counts labelled trials in the snapshot only, with the page's purposes and with all", () => {
    expect(result.summary.labelsKept["recommended"]).toEqual(rate(0, 1));
    expect(result.summary.labelsKeptAllPurposes["recommended"]).toEqual(rate(1, 1));
    expect(result.summary.labelsKept["ineligible"]).toEqual(rate(0, 0));
    expect(result.labels.find((l) => l.nctId === "NCT10000003")?.droppedAt).toBe("purpose");
  });
});
