/**
 * Readers for untyped registry JSON, shared by `trim.ts` and `snapshot-trim.ts`.
 * Moved here from `trim.ts` unchanged (slice 0001 of this repository).
 */

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * A field the project cannot work without. Records a problem and returns a
 * placeholder so that a single pass collects every fault rather than stopping at
 * the first; `trimStudy` throws before any placeholder can escape.
 */
export function required(value: unknown, path: string, problems: string[]): string {
  if (typeof value !== "string" || value.length === 0) {
    problems.push(`${path} is missing or not a non-empty string`);
    return "";
  }
  return value;
}

/** Absent optional scalars become null, and are still written to the fixture. */
export function optional(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Absent optional arrays become empty arrays, and are still written. */
export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
