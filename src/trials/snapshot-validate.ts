import { asRecord } from "./read.js";
import type { SnapshotTrial } from "./snapshot-types.js";
import { TrialFixtureError } from "./types.js";

/**
 * Confirms that one parsed snapshot line really is a `SnapshotTrial`, by hand,
 * in the style of `validate.ts`: every fault collected, then one throw naming
 * where it was read.
 */
export function validateSnapshotTrial(value: unknown, where: string): SnapshotTrial {
  const problems: string[] = [];
  const record = asRecord(value);

  if (record === undefined) {
    throw new TrialFixtureError(`Invalid snapshot trial at ${where}`, ["not a JSON object"]);
  }

  requireString(record["nctId"], "nctId", problems);
  requireString(record["briefTitle"], "briefTitle", problems);
  requireNullableString(record["officialTitle"], "officialTitle", problems);
  requireString(record["overallStatus"], "overallStatus", problems);
  requireStringArray(record["phases"], "phases", problems);
  requireNullableString(record["primaryPurpose"], "primaryPurpose", problems);
  requireStringArray(record["conditions"], "conditions", problems);
  requireStringArray(record["keywords"], "keywords", problems);
  requireStringArray(record["conditionMesh"], "conditionMesh", problems);
  requireStringArray(record["conditionAncestors"], "conditionAncestors", problems);
  requireString(record["leadSponsor"], "leadSponsor", problems);
  requireString(record["lastUpdatePostDate"], "lastUpdatePostDate", problems);
  requireNullableString(record["completionDate"], "completionDate", problems);
  validateInterventions(record["interventions"], problems);
  validateEligibility(record["eligibility"], problems);
  validateSites(record["sites"], problems);

  if (problems.length > 0) {
    throw new TrialFixtureError(`Invalid snapshot trial at ${where}`, problems);
  }

  return record as unknown as SnapshotTrial;
}

function validateInterventions(value: unknown, problems: string[]): void {
  if (!Array.isArray(value)) {
    problems.push("interventions is not an array");
    return;
  }
  value.forEach((item, i) => {
    const record = asRecord(item);
    if (record === undefined) {
      problems.push(`interventions[${i}] is not an object`);
      return;
    }
    requireNullableString(record["type"], `interventions[${i}].type`, problems);
    requireString(record["name"], `interventions[${i}].name`, problems);
  });
}

function validateEligibility(value: unknown, problems: string[]): void {
  const record = asRecord(value);
  if (record === undefined) {
    problems.push("eligibility is missing or not an object");
    return;
  }
  requireString(record["criteriaText"], "eligibility.criteriaText", problems);
  requireString(record["sex"], "eligibility.sex", problems);
  requireNullableString(record["minimumAge"], "eligibility.minimumAge", problems);
  requireNullableString(record["maximumAge"], "eligibility.maximumAge", problems);
  requireStringArray(record["stdAges"], "eligibility.stdAges", problems);
  const healthyVolunteers: unknown = record["healthyVolunteers"];
  if (typeof healthyVolunteers !== "boolean" && healthyVolunteers !== null) {
    problems.push("eligibility.healthyVolunteers is not a boolean or null");
  }
}

function validateSites(value: unknown, problems: string[]): void {
  if (!Array.isArray(value)) {
    problems.push("sites is not an array");
    return;
  }
  value.forEach((item, i) => {
    const record = asRecord(item);
    if (record === undefined) {
      problems.push(`sites[${i}] is not an object`);
      return;
    }
    for (const field of ["facility", "city", "state", "zip", "status"]) {
      requireNullableString(record[field], `sites[${i}].${field}`, problems);
    }
    for (const field of ["lat", "lon"]) {
      const n: unknown = record[field];
      if (n !== null && (typeof n !== "number" || !Number.isFinite(n))) {
        problems.push(`sites[${i}].${field} is not a number or null`);
      }
    }
  });
}

function requireString(value: unknown, field: string, problems: string[]): void {
  if (typeof value !== "string" || value.length === 0) {
    problems.push(`${field} is missing or not a non-empty string`);
  }
}

function requireNullableString(value: unknown, field: string, problems: string[]): void {
  if (value !== null && typeof value !== "string") {
    problems.push(`${field} is not a string or null`);
  }
}

function requireStringArray(value: unknown, field: string, problems: string[]): void {
  if (!Array.isArray(value)) {
    problems.push(`${field} is not an array`);
    return;
  }
  if (!value.every((item) => typeof item === "string")) {
    problems.push(`${field} contains a non-string entry`);
  }
}
