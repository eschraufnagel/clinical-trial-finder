import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";

/**
 * One trial from TREC's 2021-04-27 registry copy, read from ClinicalTrials.gov's
 * legacy XML into the shape the search reads (spec 0008 §3.3).
 *
 * TREC's physicians judged this text, not today's, so the benchmark searches
 * it. The XML is machine-written and regular, so a small tag reader covers the
 * dozen fields the search needs, and no parser dependency is added. A tag is
 * matched by its exact name, so `<intervention>` never matches
 * `<intervention_type>`, and nested fields are read inside their parent, so
 * the condition MeSH terms never pick up the intervention ones.
 *
 * Values are spelled as the snapshot spells them (`TREATMENT`, `PHASE1`,
 * `ALL`, ISO dates), so `personStages` reads a 2021 trial as it reads one from
 * 2026. What the legacy XML doesn't have is left empty: condition ancestors,
 * which the search doesn't read, and sites, because distance isn't scored on
 * 2021 trials. The criteria text is kept verbatim after entity decoding, as
 * `TrialEligibility` keeps the registry's.
 */

export class TrecXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrecXmlError";
  }
}

export function readTrecTrial(source: string): SnapshotTrial {
  // The registry puts comments inside elements ("CAUTION: The following MeSH
  // terms are assigned with an imperfect algorithm"); none carries a value.
  const xml = source.replace(/<!--[\s\S]*?-->/g, "");
  const nctId = textOf(xml, ["id_info", "nct_id"]);
  if (nctId === null) throw new TrecXmlError("A trial has no id_info/nct_id.");
  const briefTitle = textOf(xml, ["brief_title"]);
  if (briefTitle === null) throw new TrecXmlError(`${nctId} has no brief_title.`);

  const eligibility = inner(xml, "eligibility") ?? "";
  return {
    nctId,
    briefTitle,
    officialTitle: textOf(xml, ["official_title"]),
    overallStatus: statusOf(textOf(xml, ["overall_status"])),
    phases: phasesOf(textOf(xml, ["phase"])),
    primaryPurpose: codeOrNull(textOf(xml, ["study_design_info", "primary_purpose"])),
    conditions: allText(xml, "condition"),
    keywords: allText(xml, "keyword"),
    conditionMesh: allText(inner(xml, "condition_browse") ?? "", "mesh_term"),
    conditionAncestors: [],
    interventions: allInner(xml, "intervention").map((block) => ({
      type: codeOrNull(textOf(block, ["intervention_type"])),
      name: textOf(block, ["intervention_name"]) ?? "",
    })),
    leadSponsor: textOf(xml, ["sponsors", "lead_sponsor", "agency"]) ?? "",
    lastUpdatePostDate: isoDate(textOf(xml, ["last_update_posted"])) ?? "",
    completionDate: isoDate(textOf(xml, ["completion_date"])),
    eligibility: {
      criteriaText: decode(inner(inner(eligibility, "criteria") ?? "", "textblock") ?? ""),
      sex: code(textOf(eligibility, ["gender"]) ?? "ALL"),
      minimumAge: ageOf(textOf(eligibility, ["minimum_age"])),
      maximumAge: ageOf(textOf(eligibility, ["maximum_age"])),
      healthyVolunteers: volunteersOf(textOf(eligibility, ["healthy_volunteers"])),
      stdAges: [],
    },
    sites: [],
  };
}

/** The first element's inner XML, undecoded, or null. */
function inner(xml: string, tag: string): string | null {
  return elements(xml, tag).next().value ?? null;
}

function allInner(xml: string, tag: string): string[] {
  return [...elements(xml, tag)];
}

function* elements(xml: string, tag: string): Generator<string> {
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g");
  const close = `</${tag}>`;
  for (let match = open.exec(xml); match !== null; match = open.exec(xml)) {
    const start = match.index + match[0].length;
    const end = xml.indexOf(close, start);
    if (end === -1) throw new TrecXmlError(`<${tag}> is never closed.`);
    yield xml.slice(start, end);
    open.lastIndex = end + close.length;
  }
}

/** The text at a path of nested tags, decoded and trimmed; null if absent or empty. */
function textOf(xml: string, path: readonly string[]): string | null {
  let scope: string | null = xml;
  for (const tag of path) {
    if (scope === null) return null;
    scope = inner(scope, tag);
  }
  if (scope === null) return null;
  const text = decode(scope).trim();
  return text === "" ? null : text;
}

function allText(xml: string, tag: string): string[] {
  return allInner(xml, tag)
    .map((s) => decode(s).trim())
    .filter((s) => s !== "");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** "Active, not recruiting" → "ACTIVE_NOT_RECRUITING", as the API v2 spells enums. */
function code(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function codeOrNull(text: string | null): string | null {
  return text === null ? null : code(text);
}

/** The legacy "Unknown status" is the API's `UNKNOWN`; every other status codes directly. */
function statusOf(text: string | null): string {
  const status = code(text ?? "");
  return status === "UNKNOWN_STATUS" ? "UNKNOWN" : status;
}

/** "Phase 1/Phase 2" → ["PHASE1", "PHASE2"]; "Early Phase 1" → ["EARLY_PHASE1"]; "N/A" → ["NA"]. */
function phasesOf(text: string | null): string[] {
  if (text === null) return [];
  if (text.trim().toUpperCase() === "N/A") return ["NA"];
  return text.split("/").map((p) => {
    const spaced = p.trim().toUpperCase();
    return spaced.startsWith("EARLY ")
      ? `EARLY_${spaced.slice(6).replace(/\s+/g, "")}`
      : spaced.replace(/\s+/g, "");
  });
}

/** "N/A" means no limit, which the snapshot writes as null. */
function ageOf(text: string | null): string | null {
  return text === null || text.toUpperCase() === "N/A" ? null : text;
}

function volunteersOf(text: string | null): boolean | null {
  if (text === null) return null;
  if (/^no$/i.test(text)) return false;
  if (/accepts healthy volunteers|^yes$/i.test(text)) return true;
  return null;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "May 5, 2015" → "2015-05-05"; "March 2010" → "2010-03"; anything else is kept as given. */
function isoDate(text: string | null): string | null {
  if (text === null) return null;
  const match = /^([A-Za-z]+)\s+(?:(\d{1,2}),\s*)?(\d{4})$/.exec(text);
  const month = match === null ? -1 : MONTHS.indexOf((match[1] ?? "").toLowerCase());
  if (match === null || month === -1) return text;
  const ym = `${match[3]}-${String(month + 1).padStart(2, "0")}`;
  return match[2] === undefined ? ym : `${ym}-${match[2].padStart(2, "0")}`;
}
