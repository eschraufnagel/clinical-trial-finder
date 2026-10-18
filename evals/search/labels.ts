import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Disease-relevance labels for measuring the search (spec 0001 §6). Each says
 * whether a trial would consider an adult with NSCLC at all, with a reason.
 * The convention is `evals/cases/search/ANNOTATION.md`.
 */

export const NSCLC_LABELS = fileURLToPath(new URL("../cases/search/nsclc.json", import.meta.url));

export type LabelSetName = "heldout" | "dev";

export interface SearchLabel {
  nctId: string;
  set: LabelSetName;
  /** `null` only in a skeleton, before the trial is labelled. */
  relevant: boolean | null;
  reason: string;
}

export interface SearchLabels {
  version: 1;
  snapshot: string;
  cancerType: string;
  labels: SearchLabel[];
}

/** Every label filled in: what the measurement requires. */
export interface CompleteLabel extends SearchLabel {
  relevant: boolean;
}

/**
 * Reads a label file, labelled or not. Refuses a bad shape, a repeated NCT ID
 * or an unknown set, naming each problem. A label with `relevant` set must
 * have a reason, and one without must not have one yet.
 */
export function readSearchLabels(path: string = NSCLC_LABELS): SearchLabels {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error instanceof Error ? error.message : error}`);
  }
  const file = parsed as Partial<SearchLabels>;
  const problems: string[] = [];
  if (file.version !== 1) problems.push("version is not 1");
  if (typeof file.snapshot !== "string") problems.push("snapshot is not a string");
  if (typeof file.cancerType !== "string") problems.push("cancerType is not a string");
  if (!Array.isArray(file.labels)) {
    problems.push("labels is not an array");
  } else {
    const seen = new Set<string>();
    file.labels.forEach((label, i) => {
      const at = `labels[${i}]`;
      if (typeof label?.nctId !== "string" || !/^NCT\d{8}$/.test(label.nctId)) {
        problems.push(`${at}.nctId is not an NCT ID`);
      } else if (seen.has(label.nctId)) {
        problems.push(`${at}: ${label.nctId} appears more than once`);
      } else {
        seen.add(label.nctId);
      }
      if (label?.set !== "heldout" && label?.set !== "dev") {
        problems.push(`${at}.set is not "heldout" or "dev"`);
      }
      if (typeof label?.reason !== "string") {
        problems.push(`${at}.reason is not a string`);
      } else if (typeof label.relevant === "boolean" && label.reason.trim() === "") {
        problems.push(`${at} (${label.nctId}) is labelled but has no reason`);
      } else if (label.relevant === null && label.reason.trim() !== "") {
        problems.push(`${at} (${label.nctId}) has a reason but no label`);
      }
      if (label?.relevant !== null && typeof label?.relevant !== "boolean") {
        problems.push(`${at}.relevant is not true, false or null`);
      }
    });
  }
  if (problems.length > 0) {
    throw new Error(`Invalid labels ${path}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  return file as SearchLabels;
}

/** The labels, all filled in, or an error listing the ones that aren't. */
export function completeLabels(labels: SearchLabels): CompleteLabel[] {
  const open = labels.labels.filter((l) => l.relevant === null).map((l) => l.nctId);
  if (open.length > 0) {
    const shown = open.slice(0, 10).join(", ");
    throw new Error(
      `${open.length} labels aren't filled in yet: ${shown}${open.length > 10 ? ", …" : ""}`,
    );
  }
  return labels.labels as CompleteLabel[];
}

/** Of the file's bytes, so a result names exactly the labels it was scored against. */
export function labelsSha256(path: string = NSCLC_LABELS): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
