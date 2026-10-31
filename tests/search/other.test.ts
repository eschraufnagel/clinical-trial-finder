import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadZipPoints } from "../../src/search/geo.js";
import {
  inclusionSection,
  loadOthers,
  markFor,
  type Others,
  routesFor,
} from "../../src/search/other.js";
import { searchTrials } from "../../src/search/search.js";
import { loadVocabulary, VocabularyError } from "../../src/search/vocabulary.js";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";
import { trial } from "./trial-fixture.js";

/** Made-up trial records, written to break each route. Nothing here is a real study. */
const VOCABULARY = loadVocabulary("nsclc");
const OTHERS = loadOthers("nsclc") as Others;
const ALL: Others = { ...OTHERS, routes: ["small-cell", "biomarker", "listing", "rules"] };

const routes = (t: SnapshotTrial) => routesFor(t, VOCABULARY, ALL).map((r) => r.route);
const rules = (inclusion: string, exclusion = "Pregnancy.") =>
  `Inclusion Criteria:\n\n* ${inclusion}\n* Measurable disease per RECIST v1.1.\n\nExclusion Criteria:\n\n* ${exclusion}`;
const withRules = (text: string) => ({ ...trial("NCT00000000").eligibility, criteriaText: text });

describe("routesFor: small-cell", () => {
  it("marks a listing of small cell lung cancer, with a staging condition that says lung", () => {
    const t = trial("NCT00000001", {
      conditions: ["Extensive Stage Small Cell Lung Cancer", "Stage IV Lung Cancer AJCC v8"],
      eligibility: withRules(rules("Confirmed small cell lung cancer.")),
    });
    expect(routes(t)).toEqual(["small-cell"]);
  });

  it("never reads non-small cell lung cancer as small cell", () => {
    const t = trial("NCT00000002", {
      conditions: ["Non-Small Cell Lung Cancer"],
      eligibility: withRules(rules("Confirmed non-small cell lung cancer.")),
    });
    expect(routes(t)).toEqual([]);
  });

  it("leaves a trial whose inclusion section takes NSCLC, whatever its conditions", () => {
    const t = trial("NCT00000003", {
      conditions: ["Small Cell Lung Cancer"],
      eligibility: withRules(rules("SCLC transformed from EGFR-mutant NSCLC.")),
    });
    expect(routes(t)).toEqual([]);
  });

  it("doesn't read the exclusion section", () => {
    const t = trial("NCT00000004", {
      conditions: ["Small Cell Lung Cancer"],
      eligibility: withRules(rules("Confirmed SCLC.", "Transformed from NSCLC.")),
    });
    expect(routes(t)).toEqual(["small-cell"]);
  });
});

describe("routesFor: biomarker", () => {
  it("marks a lymphoma trial kept only because a condition names ALK", () => {
    const t = trial("NCT00000011", {
      conditions: ["Anaplastic Large Cell Lymphoma, ALK-Negative", "Peripheral T-Cell Lymphoma"],
      eligibility: withRules(rules("Histologically proven peripheral T-cell lymphoma.")),
    });
    expect(routes(t)).toEqual(["biomarker"]);
    expect(routesFor(t, VOCABULARY, ALL)[0]?.cancers).toEqual(["lymphoma"]);
  });
});

describe("routesFor: listing", () => {
  it("marks a listing of other cancers only, with the conditions as its evidence", () => {
    const t = trial("NCT00000021", {
      conditions: ["Pancreatic Neuroendocrine Tumor", "Extra-Pancreatic Neuroendocrine Tumor"],
      eligibility: withRules(rules("Confirmed well-differentiated NETs of pancreatic origin.")),
    });
    const [found] = routesFor(t, VOCABULARY, ALL);
    expect(found?.route).toBe("listing");
    expect(found?.evidence).toEqual(t.conditions);
  });

  it("leaves a basket whose listing names breast cancer beside solid tumors", () => {
    const t = trial("NCT00000022", {
      conditions: ["Breast Cancer", "Solid Tumors, Adult"],
      eligibility: withRules(rules("Advanced solid tumor with a PIK3CA mutation.")),
    });
    expect(routes(t)).toEqual([]);
  });

  it("leaves a listing that names lung cancer of no stated kind beside other cancers", () => {
    const t = trial("NCT00000023", {
      conditions: ["Pancreas Cancer", "Lung Cancer", "Prostate Cancer"],
      eligibility: withRules(rules("Confirmed malignancy requiring radiation.")),
    });
    expect(routes(t)).toEqual([]);
  });

  it("leaves a trial whose title is open to solid tumors, whatever its conditions", () => {
    const t = trial("NCT00000024", {
      briefTitle: "A Study of a Made-up Drug in PTEN-Altered Advanced Solid Malignancies",
      conditions: ["Breast Cancer"],
      eligibility: withRules(rules("Confirmed breast cancer, or another tumor with PTEN loss.")),
    });
    expect(routes(t)).toEqual([]);
  });

  it("doesn't read KRAS's long name as a sarcoma", () => {
    const t = trial("NCT00000025", {
      conditions: ["Kirsten Rat Sarcoma Viral Oncogene Homolog Mutation"],
      eligibility: withRules(rules("Confirmed tumor with a KRAS mutation.")),
    });
    expect(routes(t)).toEqual([]);
  });
});

describe("routesFor: rules", () => {
  const prostate = (inclusion: string) =>
    trial("NCT00000031", {
      conditions: ["Metastatic Cancer", "Neoplasm, Prostate"],
      eligibility: withRules(rules(inclusion, "No history of lung cancer.")),
    });

  it("marks a generic listing whose required diagnosis names other cancers only", () => {
    const [found] = routesFor(
      prostate("Histologically confirmed adenocarcinoma of the prostate."),
      VOCABULARY,
      ALL,
    );
    expect(found).toEqual({
      route: "rules",
      cancers: ["prostate cancer"],
      evidence: ["Histologically confirmed adenocarcinoma of the prostate."],
    });
  });

  it("leaves one whose inclusion says any solid tumor", () => {
    expect(
      routes(prostate("Confirmed prostate cancer, or any solid tumor with the alteration.")),
    ).toEqual([]);
  });

  it("leaves one with an inclusion line open to solid tumors in general beside named cancers", () => {
    expect(
      routes(prostate("Confirmed advanced solid tumor other than breast or prostate cancer.")),
    ).toEqual([]);
  });

  it("leaves one that names lung anywhere in its inclusion section", () => {
    expect(routes(prostate("Confirmed prostate, breast or lung cancer."))).toEqual([]);
  });

  it("leaves one with no inclusion heading", () => {
    const t = trial("NCT00000032", {
      conditions: ["Metastatic Cancer"],
      eligibility: withRules("* Histologically confirmed adenocarcinoma of the prostate."),
    });
    expect(routes(t)).toEqual([]);
  });

  it("finds the inclusion section between its headings", () => {
    expect(inclusionSection(rules("A.", "B."))).toEqual([
      "* A.",
      "* Measurable disease per RECIST v1.1.",
    ]);
    expect(inclusionSection("no headings")).toBeNull();
  });
});

describe("markFor", () => {
  it("takes the first adopted route, and none when no route that applies is adopted", () => {
    const t = trial("NCT00000041", {
      conditions: ["Small Cell Lung Cancer"],
      eligibility: withRules(rules("Confirmed SCLC.")),
    });
    expect(markFor(t, VOCABULARY, ALL)?.route).toBe("small-cell");
    expect(markFor(t, VOCABULARY, { ...ALL, routes: ["listing", "rules"] })).toBeNull();
  });
});

describe("loadOthers", () => {
  const dir = (file: unknown) => {
    const d = mkdtempSync(join(tmpdir(), "others-"));
    writeFileSync(join(d, "nsclc-others.json"), JSON.stringify(file));
    return d;
  };
  const committed = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../data/cancer-types/nsclc-others.json", import.meta.url)),
      "utf8",
    ),
  ) as Record<string, unknown>;

  it("loads the committed file, and gives null for a type with none", () => {
    expect(OTHERS.otherCancers.length).toBeGreaterThan(0);
    expect(loadOthers("no-such-type")).toBeNull();
  });

  it("names its checksum without the adopted routes", () => {
    const a = loadOthers("nsclc", dir({ ...committed, routes: ["small-cell"] }));
    const b = loadOthers("nsclc", dir({ ...committed, routes: [] }));
    const c = loadOthers("nsclc", dir({ ...committed, routes: [], openPhrases: ["any tumor"] }));
    expect(a?.sha256).toBe(b?.sha256);
    expect(c?.sha256).not.toBe(b?.sha256);
  });

  it("refuses an unknown route, a repeated term and an empty name", () => {
    const bad = dir({
      ...committed,
      routes: ["everything"],
      openPhrases: ["any tumor", "Any Tumor"],
      otherCancers: [{ name: "", terms: ["x"] }],
    });
    expect(() => loadOthers("nsclc", bad)).toThrow(VocabularyError);
    expect(() => loadOthers("nsclc", bad)).toThrow(
      /routes must be a list.*\n.*repeats "Any Tumor"[\s\S]*has no name/,
    );
  });
});

describe("searchTrials with the others file", () => {
  const ZIPS = loadZipPoints(fileURLToPath(new URL("./fixtures/zips.csv", import.meta.url)));
  const MANIFEST = { month: "2000-06", dataTimestamp: "2000-06-15T09:00:05" };
  const REQUEST = {
    cancerType: "nsclc",
    age: 64,
    sex: "female" as const,
    zip: "62701",
    radiusMiles: 50,
    purposes: ["TREATMENT"],
  };
  const trials = [
    trial("NCT00000051", { conditions: ["Non-Small Cell Lung Cancer"] }),
    trial("NCT00000052", {
      conditions: ["Small Cell Lung Cancer"],
      eligibility: withRules(rules("Confirmed SCLC.")),
    }),
    trial("NCT00000053", { conditions: ["Advanced Solid Tumors"] }),
  ];

  it("keeps the same candidates, funnel and reasons, and marks without dropping", () => {
    const without = searchTrials(trials, MANIFEST, VOCABULARY, ZIPS, REQUEST);
    const marked = searchTrials(trials, MANIFEST, VOCABULARY, ZIPS, REQUEST, ALL);
    expect(marked.funnel).toEqual(without.funnel);
    expect(marked.candidates.map(({ other: _, ...c }) => c)).toEqual(without.candidates);
    expect(without.candidates.some((c) => c.other !== undefined)).toBe(false);
    expect(marked.candidates.map((c) => c.other?.route)).toEqual([
      undefined,
      "small-cell",
      undefined,
    ]);
  });
});
