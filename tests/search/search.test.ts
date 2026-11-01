import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadZipPoints, UnknownZipError } from "../../src/search/geo.js";
import { parseAgeLimit, personStages, recordFlags, searchTrials } from "../../src/search/search.js";
import type { SearchRequest } from "../../src/search/types.js";
import { loadVocabulary } from "../../src/search/vocabulary.js";
import { rules, site, trial } from "./trial-fixture.js";

/** Five real ZCTA centroids; 62701 is Springfield, Illinois, where the fixture's default site is. */
const ZIPS = loadZipPoints(fileURLToPath(new URL("./fixtures/zips.csv", import.meta.url)));
const VOCABULARY = loadVocabulary("nsclc");
const MANIFEST = { month: "2000-06", dataTimestamp: "2000-06-15T09:00:05" };

const REQUEST: SearchRequest = {
  cancerType: "nsclc",
  age: 64,
  sex: "female",
  zip: "62701",
  radiusMiles: 50,
  purposes: ["TREATMENT"],
};

const lung = { conditions: ["Non-Small Cell Lung Cancer"] };
const search = (trials: Parameters<typeof searchTrials>[0], request: Partial<SearchRequest> = {}) =>
  searchTrials(trials, MANIFEST, VOCABULARY, ZIPS, { ...REQUEST, ...request });
const ids = (result: ReturnType<typeof search>) => result.candidates.map((c) => c.nctId);

describe("searchTrials", () => {
  it("keeps treatment trials, and trials with no stated purpose", () => {
    const result = search([
      trial("NCT00000001", lung),
      trial("NCT00000002", { ...lung, primaryPurpose: "SUPPORTIVE_CARE" }),
      trial("NCT00000003", { ...lung, primaryPurpose: null }),
    ]);
    expect(ids(result)).toEqual(["NCT00000001", "NCT00000003"]);
    expect(
      ids(
        search([trial("NCT00000002", { ...lung, primaryPurpose: "SUPPORTIVE_CARE" })], {
          purposes: "all",
        }),
      ),
    ).toEqual(["NCT00000002"]);
  });

  it("keeps trials for the cancer type with every reason they were kept, and drops the rest", () => {
    const result = search([
      trial("NCT00000001", lung),
      trial("NCT00000002", { conditions: ["Advanced Solid Tumor"] }),
      trial("NCT00000003", rules("Cohort C: NSCLC")),
      trial("NCT00000004"),
    ]);
    expect(result.candidates.map((c) => [c.nctId, c.reasons])).toEqual([
      ["NCT00000001", ["names"]],
      ["NCT00000002", ["generic"]],
      ["NCT00000003", ["rules"]],
    ]);
  });

  it("reads age limits in any unit, and keeps a trial whose limit doesn't read, flagged", () => {
    const limits = (minimumAge: string | null, maximumAge: string | null) => ({
      ...lung,
      eligibility: { ...trial("x").eligibility, minimumAge, maximumAge },
    });
    const result = search([
      trial("NCT00000001", limits("18 Years", "65 Years")),
      trial("NCT00000002", limits("18 Years", "60 Years")),
      trial("NCT00000003", limits("6 Months", "780 Months")),
      trial("NCT00000004", limits("adults", null)),
      trial("NCT00000005", limits(null, null)),
    ]);
    expect(ids(result)).toEqual(["NCT00000001", "NCT00000003", "NCT00000004", "NCT00000005"]);
    expect(result.candidates.find((c) => c.nctId === "NCT00000004")?.flags).toContain(
      "age-limit-unread",
    );
  });

  it("keeps a trial for all sexes or the person's own", () => {
    const sex = (s: string) => ({ ...lung, eligibility: { ...trial("x").eligibility, sex: s } });
    const trials = [
      trial("NCT00000001", sex("ALL")),
      trial("NCT00000002", sex("FEMALE")),
      trial("NCT00000003", sex("MALE")),
    ];
    expect(ids(search(trials))).toEqual(["NCT00000001", "NCT00000002"]);
    expect(ids(search(trials, { sex: "male" }))).toEqual(["NCT00000001", "NCT00000003"]);
  });

  it("counts only recruiting sites, or sites with no status, and measures to the nearest", () => {
    const chicago = site({ city: "Chicago", zip: "60611", lat: 41.894742, lon: -87.615073 });
    const result = search(
      [
        trial("NCT00000001", { ...lung, sites: [site({ status: "NOT_YET_RECRUITING" })] }),
        trial("NCT00000002", { ...lung, sites: [chicago, site({ status: null })] }),
        trial("NCT00000003", { ...lung, sites: [chicago] }),
      ],
      { radiusMiles: 300 },
    );
    expect(ids(result)).toEqual(["NCT00000002", "NCT00000003"]);
    expect(result.candidates[0]?.nearestSite).toEqual({
      facility: "Example Hospital",
      city: "Springfield",
      state: "Illinois",
      miles: 0,
    });
    expect(result.candidates[1]?.nearestSite?.miles).toBeGreaterThan(150);
  });

  it("drops a trial with no site within the radius, and keeps it with radius null", () => {
    const far = [
      trial("NCT00000001", { ...lung, sites: [site({ lat: 61.219998, lon: -149.85784 })] }),
    ];
    expect(ids(search(far))).toEqual([]);
    expect(ids(search(far, { radiusMiles: null }))).toEqual(["NCT00000001"]);
    expect(
      ids(search([trial("NCT00000002", { ...lung, sites: [] })], { radiusMiles: null })),
    ).toEqual([]);
  });

  it("keeps a trial whose only nearby chance is a site with no coordinates, flagged and last", () => {
    const result = search([
      trial("NCT00000001", {
        ...lung,
        sites: [
          site({ lat: null, lon: null, zip: null }),
          site({ lat: 61.219998, lon: -149.85784 }),
        ],
      }),
      trial("NCT00000002", lung),
    ]);
    expect(ids(result)).toEqual(["NCT00000002", "NCT00000001"]);
    expect(result.candidates[1]?.flags).toEqual(["site-distance-unknown"]);
    expect(result.candidates[1]?.nearestSite?.miles).toBeNull();
  });

  it("places a site with no coordinates by its ZIP", () => {
    const unlocated = (zip: string) =>
      trial("NCT00000001", { ...lung, sites: [site({ lat: null, lon: null, zip })] });
    expect(ids(search([unlocated("99501")]))).toEqual([]);
    const near = search([unlocated("62701")]);
    expect(ids(near)).toEqual(["NCT00000001"]);
    expect(near.candidates[0]?.nearestSite?.miles).toBe(0);
    expect(near.candidates[0]?.flags).toEqual([]);
  });

  it("counts every stage of the funnel, ending at the candidates", () => {
    const result = search([
      trial("NCT00000001", lung),
      trial("NCT00000002", { ...lung, primaryPurpose: "DIAGNOSTIC" }),
      trial("NCT00000003"),
      trial("NCT00000004", {
        ...lung,
        eligibility: { ...trial("x").eligibility, maximumAge: "21 Years" },
      }),
      trial("NCT00000005", { ...lung, sites: [site({ lat: 61.219998, lon: -149.85784 })] }),
    ]);
    expect(result.funnel).toEqual([
      { stage: "snapshot", count: 5 },
      { stage: "purpose", count: 4 },
      { stage: "cancer", count: 3 },
      { stage: "age-and-sex", count: 2 },
      { stage: "distance", count: 1 },
    ]);
    expect(result.funnel.at(-1)?.count).toBe(result.candidates.length);
  });

  it("orders by distance, unknown last, then NCT ID", () => {
    const result = search([
      trial("NCT00000003", lung),
      trial("NCT00000001", lung),
      trial("NCT00000002", lung),
    ]);
    expect(ids(result)).toEqual(["NCT00000001", "NCT00000002", "NCT00000003"]);
  });

  it("refuses a ZIP it can't place", () => {
    expect(() => search([trial("NCT00000001", lung)], { zip: "00000" })).toThrow(UnknownZipError);
  });
});

describe("personStages", () => {
  const trials = [
    trial("NCT00000001", lung),
    trial("NCT00000002", { ...lung, primaryPurpose: "DIAGNOSTIC" }),
    trial("NCT00000003"),
    trial("NCT00000004", {
      ...lung,
      eligibility: { ...trial("x").eligibility, maximumAge: "21 Years" },
    }),
    trial("NCT00000005", { ...lung, sites: [site({ lat: 61.219998, lon: -149.85784 })] }),
    trial("NCT00000006", {
      conditions: ["Advanced Solid Tumor"],
      eligibility: { ...trial("x").eligibility, minimumAge: "eighteen" },
    }),
    trial("NCT00000007", { ...lung, sites: [] }),
  ];

  it("gives searchTrials' funnel up to age and sex, and the trials it then places", () => {
    const stages = personStages(trials, VOCABULARY, REQUEST);
    const result = search(trials);
    expect(stages.funnel).toEqual(result.funnel.slice(0, 4));
    expect(stages.entries.map((e) => e.trial.nctId)).toEqual([
      "NCT00000001",
      "NCT00000005",
      "NCT00000006",
      "NCT00000007",
    ]);
    // Distance then drops the far site and the trial with none.
    expect(ids(result)).toEqual(["NCT00000001", "NCT00000006"]);
  });

  it("keeps each trial's reasons and how its age limit read", () => {
    const stages = personStages(trials, VOCABULARY, REQUEST);
    const byId = new Map(stages.entries.map((e) => [e.trial.nctId, e]));
    expect(byId.get("NCT00000001")).toMatchObject({ reasons: ["names"], age: "yes" });
    expect(byId.get("NCT00000006")).toMatchObject({ reasons: ["generic"], age: "unread" });
  });

  it("needs no ZIP: a trial with no sites is still kept", () => {
    const { entries } = personStages(trials, VOCABULARY, {
      age: 64,
      sex: "female",
      purposes: "all",
    });
    expect(entries.map((e) => e.trial.nctId)).toContain("NCT00000007");
    expect(entries.map((e) => e.trial.nctId)).toContain("NCT00000002");
  });
});

describe("parseAgeLimit", () => {
  it("reads years, months, weeks and days, singular or plural", () => {
    expect(parseAgeLimit("18 Years")).toBe(18);
    expect(parseAgeLimit("1 Year")).toBe(1);
    expect(parseAgeLimit("6 Months")).toBe(0.5);
    expect(parseAgeLimit("365 Days")).toBeCloseTo(1, 2);
    expect(parseAgeLimit("52 Weeks")).toBeCloseTo(1, 1);
    expect(parseAgeLimit(null)).toBeNull();
    expect(parseAgeLimit("adult")).toBe("unread");
  });
});

describe("recordFlags", () => {
  const at = "2000-06-15T09:00:05";
  it("flags a record not updated for more than a year before the registry's data, never the clock", () => {
    expect(recordFlags(trial("NCT00000001", { lastUpdatePostDate: "1999-06-14" }), at)).toContain(
      "stale-record",
    );
    expect(
      recordFlags(trial("NCT00000001", { lastUpdatePostDate: "1999-06-15" }), at),
    ).not.toContain("stale-record");
  });

  it("flags a completion date already past, a month-only date counting as its last day", () => {
    expect(recordFlags(trial("NCT00000001", { completionDate: "2000-05" }), at)).toEqual([
      "past-completion",
    ]);
    expect(recordFlags(trial("NCT00000001", { completionDate: "2000-06" }), at)).toEqual([]);
    expect(recordFlags(trial("NCT00000001", { completionDate: "2000-06-14" }), at)).toEqual([
      "past-completion",
    ]);
    expect(recordFlags(trial("NCT00000001", { completionDate: null }), at)).toEqual([]);
  });
});
