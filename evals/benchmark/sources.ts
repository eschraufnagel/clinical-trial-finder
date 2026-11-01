import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the benchmarks' downloads are, and the manifest that pins them
 * (spec 0008 §2). A person downloads the files into `local/benchmark/`, which
 * is gitignored; no script fetches them, so no host joins the network
 * exceptions. The import checks every input against the committed manifest
 * and refuses on any difference, so the committed files can always be traced
 * to the bytes they were read from.
 */

export const LOCAL_BENCHMARK_DIR = fileURLToPath(new URL("../../local/benchmark", import.meta.url));
export const BENCHMARK_DATA_DIR = fileURLToPath(new URL("../../data/benchmark", import.meta.url));
export const SOURCES_PATH = join(BENCHMARK_DATA_DIR, "sources.json");

export const TRIALBENCH_REPOSITORY = "https://github.com/TrialGPT2/TrialGPT2.0";
export const TRIALBENCH_COMMIT = "1c5f9ebc3b98d1f780ceea68043efdaa2daba880";
export const TREC_CORPUS_PARTS = [1, 2, 3, 4, 5] as const;

/** One downloaded input. A path ending in "/" is a folder, checksummed by its listing. */
export interface SourceInput {
  path: string;
  url: string;
}

export interface SourceFile extends SourceInput {
  sha256: string;
}

export interface SourcesManifest {
  version: 1;
  files: SourceFile[];
  trialbench: { repository: string; commit: string };
  licenses: { trec: string; trialbench: string };
  citations: { trec: string; trialbench: string };
}

const trialbenchRaw = (name: string) =>
  `${TRIALBENCH_REPOSITORY}/blob/${TRIALBENCH_COMMIT}/data/nih_trialbench/${name}`;

/** Every input the import reads, relative to `local/benchmark/`. */
export const SOURCE_INPUTS: readonly SourceInput[] = [
  ...(["2021", "2022"] as const).flatMap((year) => [
    {
      path: `trec/topics${year}.xml`,
      url: `https://trec.nist.gov/data/trials/topics${year}.xml`,
    },
    { path: `trec/qrels${year}.txt`, url: `https://trec.nist.gov/data/trials/qrels${year}.txt` },
  ]),
  ...TREC_CORPUS_PARTS.map((part) => ({
    path: `trec/zips/ClinicalTrials.2021-04-27.part${part}.zip`,
    url: `https://www.trec-cds.org/2021_data/ClinicalTrials.2021-04-27.part${part}.zip`,
  })),
  ...["README.md", "patients.jsonl", "clinician_annotations.jsonl", "trial_search_space.jsonl"].map(
    (name) => ({ path: `trialbench/raw/${name}`, url: trialbenchRaw(`raw/${name}`) }),
  ),
  { path: "trialbench/trials/", url: trialbenchRaw("trials") },
];

export const LICENSES = {
  trec: "None stated on trec.nist.gov or trec-cds.org.",
  trialbench:
    'Public domain: the National Library of Medicine\'s notice in LICENSE at the pinned commit ("a United States Government Work ... no restriction on its use or reproduction").',
};

export const CITATIONS = {
  trec: "TREC 2021 and 2022 Clinical Trials Track, National Institute of Standards and Technology: https://trec.nist.gov/data/trials2021.html and https://trec.nist.gov/data/trials2022.html; document collection from https://www.trec-cds.org/2021.html.",
  trialbench:
    "Fang Y, Jin Q, et al. Towards AI-Assisted Clinical Trial Matching: Practical Considerations, Multicenter Evaluation, and Real-World Deployment. arXiv:2609.01202 (TrialGPT 2.0, NIH-TrialBench).",
};

/** A file's sha256, read in chunks: the corpus zips are about 380 MB each. */
export function fileSha256(path: string): string {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(1 << 20);
  const fd = openSync(path, "r");
  try {
    for (let n = readSync(fd, buffer); n > 0; n = readSync(fd, buffer)) {
      hash.update(buffer.subarray(0, n));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** A folder's sha256: of each file's name and sha256, one per line, sorted by name. */
export function folderSha256(dir: string): string {
  const lines = readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort()
    .map((name) => `${name}\t${fileSha256(join(dir, name))}\n`);
  return createHash("sha256").update(lines.join("")).digest("hex");
}

export function inputSha256(root: string, path: string): string {
  return path.endsWith("/") ? folderSha256(join(root, path)) : fileSha256(join(root, path));
}

export function buildManifest(root: string): SourcesManifest {
  return {
    version: 1,
    files: SOURCE_INPUTS.map((input) => ({ ...input, sha256: inputSha256(root, input.path) })),
    trialbench: { repository: TRIALBENCH_REPOSITORY, commit: TRIALBENCH_COMMIT },
    licenses: LICENSES,
    citations: CITATIONS,
  };
}

/** Every way the downloads differ from the manifest; empty when they match. */
export function checkSources(root: string, manifest: SourcesManifest): string[] {
  const problems: string[] = [];
  for (const file of manifest.files) {
    if (!existsSync(join(root, file.path))) {
      problems.push(`${file.path} is missing: download it from ${file.url}.`);
    } else if (inputSha256(root, file.path) !== file.sha256) {
      problems.push(`${file.path} doesn't match its sha256 in the manifest.`);
    }
  }
  return problems;
}

export function readManifest(path = SOURCES_PATH): SourcesManifest {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as SourcesManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) {
    throw new Error(`${path} isn't a version 1 sources manifest.`);
  }
  return manifest;
}

/** Pretty JSON with a final newline, so a rerun of the import writes the same bytes. */
export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
