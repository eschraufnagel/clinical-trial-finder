import { asRecord, optional, required, stringArray } from "./read.js";
import type { Intervention, Site, SnapshotTrial } from "./snapshot-types.js";
import { trimEligibility } from "./trim.js";
import { TrialFixtureError } from "./types.js";

/**
 * Turns one ClinicalTrials.gov API v2 study into a `SnapshotTrial`.
 *
 * Pure, and held to `trimStudy`'s rules: each field is read from one path,
 * nothing is inferred or merged, and every missing required field is reported
 * before throwing. Only United States locations are kept, and of each only
 * where it is and whether it's recruiting. Location contacts, central contacts
 * and officials are never read.
 */
export function trimSnapshotStudy(raw: unknown, source = "study"): SnapshotTrial {
  const problems: string[] = [];
  const root = asRecord(raw);
  const protocol = asRecord(root?.["protocolSection"]);

  if (protocol === undefined) {
    throw new TrialFixtureError(`Cannot read ${source}`, [
      "protocolSection is missing or not an object",
    ]);
  }

  const identification = asRecord(protocol["identificationModule"]);
  const status = asRecord(protocol["statusModule"]);
  const design = asRecord(protocol["designModule"]);
  const conditions = asRecord(protocol["conditionsModule"]);
  const sponsors = asRecord(protocol["sponsorCollaboratorsModule"]);
  const arms = asRecord(protocol["armsInterventionsModule"]);
  const locations = asRecord(protocol["contactsLocationsModule"]);
  const browse = asRecord(asRecord(root?.["derivedSection"])?.["conditionBrowseModule"]);

  const trial: SnapshotTrial = {
    nctId: required(identification?.["nctId"], "identificationModule.nctId", problems),
    briefTitle: required(
      identification?.["briefTitle"],
      "identificationModule.briefTitle",
      problems,
    ),
    officialTitle: optional(identification?.["officialTitle"]),
    overallStatus: required(status?.["overallStatus"], "statusModule.overallStatus", problems),
    phases: stringArray(design?.["phases"]),
    primaryPurpose: optional(asRecord(design?.["designInfo"])?.["primaryPurpose"]),
    conditions: stringArray(conditions?.["conditions"]),
    keywords: stringArray(conditions?.["keywords"]),
    conditionMesh: terms(browse?.["meshes"]),
    conditionAncestors: terms(browse?.["ancestors"]),
    interventions: interventions(arms?.["interventions"]),
    leadSponsor: required(
      asRecord(sponsors?.["leadSponsor"])?.["name"],
      "sponsorCollaboratorsModule.leadSponsor.name",
      problems,
    ),
    lastUpdatePostDate: required(
      asRecord(status?.["lastUpdatePostDateStruct"])?.["date"],
      "statusModule.lastUpdatePostDateStruct.date",
      problems,
    ),
    completionDate: optional(asRecord(status?.["completionDateStruct"])?.["date"]),
    eligibility: trimEligibility(asRecord(protocol["eligibilityModule"]), problems),
    sites: usSites(locations?.["locations"]),
  };

  if (problems.length > 0) {
    throw new TrialFixtureError(`Cannot read ${source}`, problems);
  }

  return trial;
}

/** `[{ term }]` lists from the derived section, such as MeSH headings. */
function terms(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const term = asRecord(item)?.["term"];
    return typeof term === "string" && term.length > 0 ? [term] : [];
  });
}

function interventions(value: unknown): Intervention[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const record = asRecord(item);
    const name = record?.["name"];
    return typeof name === "string" && name.length > 0
      ? [{ type: optional(record?.["type"]), name }]
      : [];
  });
}

function usSites(value: unknown): Site[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const location = asRecord(item);
    if (location?.["country"] !== "United States") {
      return [];
    }
    const geo = asRecord(location["geoPoint"]);
    return [
      {
        facility: optional(location["facility"]),
        city: optional(location["city"]),
        state: optional(location["state"]),
        zip: optional(location["zip"]),
        status: optional(location["status"]),
        lat: finite(geo?.["lat"]),
        lon: finite(geo?.["lon"]),
      },
    ];
  });
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
