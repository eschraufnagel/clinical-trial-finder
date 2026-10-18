import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  MANIFEST_FILE,
  SNAPSHOT_FIELDS,
  SNAPSHOT_FILE,
  type SnapshotManifest,
  type SnapshotTrial,
} from "./snapshot-types.js";
import { TrialFixtureError } from "./types.js";

/**
 * One `SnapshotTrial` per line, sorted by NCT ID, keys in declaration order,
 * with a trailing newline. The same trials always give the same bytes, so a
 * refetch that changes nothing changes no file.
 */
export function serializeSnapshot(trials: readonly SnapshotTrial[]): string {
  const sorted = [...trials].sort((a, b) => compareIds(a.nctId, b.nctId));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]?.nctId === sorted[i - 1]?.nctId) {
      throw new TrialFixtureError("Cannot write snapshot", [
        `${sorted[i]?.nctId} appears more than once`,
      ]);
    }
  }
  return sorted.map((trial) => `${JSON.stringify(ordered(trial))}\n`).join("");
}

/**
 * Writes `trials.jsonl.gz` and `manifest.json` to `dir`, and returns the
 * manifest. Gzip at level 9; Node writes a zero mtime in the header, so the
 * compressed bytes are as stable as the lines.
 */
export function writeSnapshot(
  dir: string,
  trials: readonly SnapshotTrial[],
  meta: { dataTimestamp: string; query: string },
): SnapshotManifest {
  const compressed = gzipSync(Buffer.from(serializeSnapshot(trials), "utf8"), { level: 9 });
  const manifest: SnapshotManifest = {
    version: 1,
    month: meta.dataTimestamp.slice(0, 7),
    dataTimestamp: meta.dataTimestamp,
    query: meta.query,
    count: trials.length,
    sha256: sha256Hex(compressed),
    fields: [...SNAPSHOT_FIELDS],
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, SNAPSHOT_FILE), compressed);
  writeFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Plain code-unit order, the same in every locale. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function ordered(trial: SnapshotTrial): SnapshotTrial {
  return {
    nctId: trial.nctId,
    briefTitle: trial.briefTitle,
    officialTitle: trial.officialTitle,
    overallStatus: trial.overallStatus,
    phases: trial.phases,
    primaryPurpose: trial.primaryPurpose,
    conditions: trial.conditions,
    keywords: trial.keywords,
    conditionMesh: trial.conditionMesh,
    conditionAncestors: trial.conditionAncestors,
    interventions: trial.interventions.map((i) => ({ type: i.type, name: i.name })),
    leadSponsor: trial.leadSponsor,
    lastUpdatePostDate: trial.lastUpdatePostDate,
    completionDate: trial.completionDate,
    eligibility: {
      criteriaText: trial.eligibility.criteriaText,
      sex: trial.eligibility.sex,
      minimumAge: trial.eligibility.minimumAge,
      maximumAge: trial.eligibility.maximumAge,
      healthyVolunteers: trial.eligibility.healthyVolunteers,
      stdAges: trial.eligibility.stdAges,
    },
    sites: trial.sites.map((s) => ({
      facility: s.facility,
      city: s.city,
      state: s.state,
      zip: s.zip,
      status: s.status,
      lat: s.lat,
      lon: s.lon,
    })),
  };
}
