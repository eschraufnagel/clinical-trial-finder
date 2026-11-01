import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkSources,
  fileSha256,
  folderSha256,
  type SourcesManifest,
} from "../../evals/benchmark/sources.js";
import {
  loadTrec,
  readQrels,
  readTopics,
  readTrialsGz,
  TREC_TOPICS,
  trecProblems,
  trialsGz,
} from "../../evals/benchmark/trec.js";
import {
  benchTrialFrom,
  labelsFrom,
  loadTrialBench,
  type ReleaseTrial,
  trialBenchProblems,
  vignettesFrom,
} from "../../evals/benchmark/trialbench.js";
import { trial } from "../search/trial-fixture.js";

const scratch = mkdtempSync(join(tmpdir(), "benchmark-import-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("the sources manifest", () => {
  const root = join(scratch, "local");
  mkdirSync(join(root, "folder"), { recursive: true });
  writeFileSync(join(root, "a.txt"), "first");
  writeFileSync(join(root, "folder", "x.json"), "{}");
  writeFileSync(join(root, "folder", "y.json"), "[]");
  const manifest: SourcesManifest = {
    version: 1,
    trialbench: { repository: "r", commit: "c" },
    licenses: { trec: "", trialbench: "" },
    citations: { trec: "", trialbench: "" },
    files: [
      { path: "a.txt", url: "u", sha256: fileSha256(join(root, "a.txt")) },
      { path: "folder/", url: "u", sha256: folderSha256(join(root, "folder")) },
    ],
  };

  it("passes downloads that match", () => {
    expect(checkSources(root, manifest)).toEqual([]);
  });

  it("names a file whose checksum differs, and a missing one with where to get it", () => {
    const changed = {
      ...manifest,
      files: [
        { path: "a.txt", url: "u", sha256: "0".repeat(64) },
        { path: "gone.txt", url: "https://example.org/gone.txt", sha256: "0".repeat(64) },
      ],
    };
    expect(checkSources(root, changed)).toEqual([
      "a.txt doesn't match its sha256 in the manifest.",
      "gone.txt is missing: download it from https://example.org/gone.txt.",
    ]);
  });

  it("checksums a folder by its files' names and contents", () => {
    const before = folderSha256(join(root, "folder"));
    writeFileSync(join(root, "folder", "y.json"), "[1]");
    expect(folderSha256(join(root, "folder"))).not.toBe(before);
  });
});

describe("TREC's files", () => {
  it("reads topics, verbatim, by year and number", () => {
    const xml =
      '<topics><topic number="4">\nA note.\n</topic><topic number="11">B</topic></topics>';
    expect(readTopics(xml, "2022")).toEqual([
      { year: "2022", number: 4, text: "\nA note.\n" },
      { year: "2022", number: 11, text: "B" },
    ]);
  });

  it("reads judgments, naming each note by year so 2021-11 and 2022-11 differ", () => {
    expect(readQrels("11 0 NCT00000001 2\n11 0 NCT00000002 0\n", "2022")).toEqual([
      { topic: "2022-11", nctId: "NCT00000001", judgment: 2 },
      { topic: "2022-11", nctId: "NCT00000002", judgment: 0 },
    ]);
    expect(() => readQrels("11 0 NCT00000001 3\n", "2021")).toThrow(/unreadable/);
  });

  it("writes trials sorted, so the same trials give the same bytes", () => {
    const a = trial("NCT00000002");
    const b = trial("NCT00000001");
    expect(trialsGz([a, b]).equals(trialsGz([b, a]))).toBe(true);
    const path = join(scratch, "t.jsonl.gz");
    writeFileSync(path, trialsGz([a, b]));
    expect(readTrialsGz<{ nctId: string }>(path).map((t) => t.nctId)).toEqual([
      "NCT00000001",
      "NCT00000002",
    ]);
  });

  it("finds a note that isn't one of the nine, and a judged trial with no record", () => {
    const topics = TREC_TOPICS.map((t) => ({ ...t, text: "" }));
    expect(
      trecProblems({
        topics: [...topics, { year: "2021", number: 13, text: "" }],
        judgments: [{ topic: "2021-1", nctId: "NCT00000009", judgment: 2 }],
        trials: [],
      }),
    ).toEqual([
      "Note 2021-13 isn't one of the nine.",
      "NCT00000009, judged for 2021-1, has no trial.",
    ]);
  });

  it("the committed files agree with each other and hold the nine notes", () => {
    const data = loadTrec();
    expect(data.topics).toHaveLength(9);
    expect(data.judgments).toHaveLength(4672);
    expect(data.trials).toHaveLength(4297);
  });
});

describe("NIH-TrialBench's files", () => {
  const patient = (id: string, ic: string) => ({
    patient_id: id,
    ic,
    patient_summary: `Summary of ${id}.`,
    target_trial_id: "NCT00000001",
  });

  it("keeps NCI's vignettes only, verbatim", () => {
    expect(vignettesFrom([patient("nci-01", "NCI"), patient("nei-01", "NEI")])).toEqual([
      { patient: "nci-01", ic: "NCI", targetTrial: "NCT00000001", summary: "Summary of nci-01." },
    ]);
  });

  it("keeps NCI's labels, with comments, and refuses a label it doesn't know", () => {
    const row = (label: string) => ({
      patient_id: "nci-01",
      ic: "NCI",
      annotations: [{ trial_id: "NCT00000001", clinician_label: label, clinician_comment: "Why." }],
    });
    expect(labelsFrom([row("ineligible"), { ...row("recommended"), ic: "NEI" }])).toEqual([
      { patient: "nci-01", nctId: "NCT00000001", label: "ineligible", comment: "Why." },
    ]);
    expect(() => labelsFrom([row("maybe")])).toThrow(/has label "maybe"/);
  });

  it("builds a trial from the search space's words and the release file's limits", () => {
    const release: ReleaseTrial = {
      nctid: "NCT00000001",
      title: "An updated title",
      condition: ["Cervical Cancer"],
      phases: ["PHASE1"],
      minimum_age: "18 Years",
      maximum_age: "",
      sex: "ALL",
      raw_criteria: "Updated criteria.",
    };
    const space = {
      trial_id: "NCT00000001",
      trial_title: "The title",
      raw_criteria: "The criteria.",
      study_type: "INTERVENTIONAL",
    };
    expect(benchTrialFrom(space, release)).toEqual({
      nctId: "NCT00000001",
      briefTitle: "The title",
      conditions: ["Cervical Cancer"],
      phases: ["PHASE1"],
      minimumAge: "18 Years",
      maximumAge: null,
      sex: "ALL",
      criteriaText: "The criteria.",
    });
    expect(() => benchTrialFrom({ ...space, trial_id: "NCT00000002" }, release)).toThrow();
  });

  it("finds a label with no vignette and a target with no trial", () => {
    expect(
      trialBenchProblems({
        vignettes: [{ patient: "nci-01", ic: "NCI", targetTrial: "NCT00000009", summary: "" }],
        labels: [{ patient: "nci-02", nctId: "NCT00000009", label: "recommended", comment: "" }],
        trials: [],
      }),
    ).toEqual([
      "nci-01's target NCT00000009 has no trial.",
      "A label is for nci-02, who has no vignette.",
      "nci-02 × NCT00000009 has no trial.",
    ]);
  });

  it("the committed files agree with each other", () => {
    const data = loadTrialBench();
    expect(data.vignettes).toHaveLength(41);
    expect(data.labels).toHaveLength(395);
    expect(data.trials).toHaveLength(106);
  });
});
