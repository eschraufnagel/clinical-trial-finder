import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { asRecord } from "./read.js";
import {
  MANIFEST_FILE,
  SNAPSHOT_FILE,
  type SnapshotManifest,
  type SnapshotTrial,
} from "./snapshot-types.js";
import { validateSnapshotTrial } from "./snapshot-validate.js";
import { TrialFixtureError } from "./types.js";

/** The pinned snapshot the evals measure against (spec 0001 §2.3). */
export const DEFAULT_SNAPSHOT_DIR = fileURLToPath(
  new URL("../../data/snapshot/2026-10", import.meta.url),
);

export interface Snapshot {
  manifest: SnapshotManifest;
  trials: SnapshotTrial[];
}

/**
 * Reads a snapshot: the manifest, then the compressed trials, checked against
 * it. No network, ever. Synchronous, and about a second for the full snapshot,
 * so tests never load the real one.
 *
 * Every fault throws `TrialFixtureError` naming the file, and the line where
 * there is one: a checksum that doesn't match, a line that isn't a valid
 * trial, IDs out of order or repeated, or a count that disagrees.
 */
export function loadSnapshot(dir: string = DEFAULT_SNAPSHOT_DIR): Snapshot {
  const manifestPath = join(dir, MANIFEST_FILE);
  const dataPath = join(dir, SNAPSHOT_FILE);
  const manifest = readManifest(manifestPath);

  let compressed: Buffer;
  try {
    compressed = readFileSync(dataPath);
  } catch {
    throw new TrialFixtureError(`Missing snapshot ${dataPath}`, [
      "file does not exist or cannot be read; run `npm run snapshot:fetch`",
    ]);
  }

  const sha = createHash("sha256").update(compressed).digest("hex");
  if (sha !== manifest.sha256) {
    throw new TrialFixtureError(`Snapshot ${dataPath} doesn't match its manifest`, [
      `sha256 is ${sha}, manifest says ${manifest.sha256}`,
    ]);
  }

  let text: string;
  try {
    text = gunzipSync(compressed).toString("utf8");
  } catch (error) {
    throw new TrialFixtureError(`Cannot decompress ${dataPath}`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  const trials: SnapshotTrial[] = [];
  lines.forEach((line, i) => {
    const where = `${dataPath} line ${i + 1}`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new TrialFixtureError(`Malformed JSON at ${where}`, [
        error instanceof Error ? error.message : String(error),
      ]);
    }
    const trial = validateSnapshotTrial(parsed, where);
    const previous = trials[trials.length - 1];
    if (previous !== undefined && !(previous.nctId < trial.nctId)) {
      throw new TrialFixtureError(`Snapshot out of order at ${where}`, [
        previous.nctId === trial.nctId
          ? `${trial.nctId} appears more than once`
          : `${trial.nctId} comes after ${previous.nctId}`,
      ]);
    }
    trials.push(trial);
  });

  if (trials.length !== manifest.count) {
    throw new TrialFixtureError(`Snapshot ${dataPath} doesn't match its manifest`, [
      `${trials.length} trials, manifest says ${manifest.count}`,
    ]);
  }

  return { manifest, trials };
}

function readManifest(path: string): SnapshotManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new TrialFixtureError(`Cannot read snapshot manifest ${path}`, [
      "file is missing or not JSON; run `npm run snapshot:fetch`",
    ]);
  }
  const record = asRecord(parsed);
  const problems: string[] = [];
  if (record?.["version"] !== 1) problems.push("version is not 1");
  for (const field of ["month", "dataTimestamp", "query", "sha256"]) {
    if (typeof record?.[field] !== "string" || record[field] === "") {
      problems.push(`${field} is missing or not a non-empty string`);
    }
  }
  if (!Number.isInteger(record?.["count"])) problems.push("count is not an integer");
  const fields: unknown = record?.["fields"];
  if (!Array.isArray(fields) || !fields.every((f) => typeof f === "string")) {
    problems.push("fields is not an array of strings");
  }
  if (problems.length > 0) {
    throw new TrialFixtureError(`Invalid snapshot manifest ${path}`, problems);
  }
  return record as unknown as SnapshotManifest;
}
