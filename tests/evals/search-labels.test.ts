import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completeLabels, readSearchLabels } from "../../evals/search/labels.js";

function file(labels: unknown[], extra: Record<string, unknown> = {}): string {
  const path = join(mkdtempSync(join(tmpdir(), "labels-")), "nsclc.json");
  writeFileSync(
    path,
    JSON.stringify({ version: 1, snapshot: "2000-01", cancerType: "nsclc", labels, ...extra }),
  );
  return path;
}

const done = {
  nctId: "NCT00000001",
  set: "heldout",
  relevant: true,
  reason: "Conditions name NSCLC.",
};
const open = { nctId: "NCT00000002", set: "dev", relevant: null, reason: "" };

describe("readSearchLabels", () => {
  it("reads a file with labelled and unlabelled trials", () => {
    expect(readSearchLabels(file([done, open])).labels).toHaveLength(2);
  });

  it("names every problem at once", () => {
    const path = file(
      [
        done,
        done,
        { ...open, nctId: "NCT1" },
        { ...open, nctId: "NCT00000003", set: "test" },
        { ...open, nctId: "NCT00000004", relevant: true },
        { ...open, nctId: "NCT00000005", reason: "a reason with no label" },
        { ...open, nctId: "NCT00000006", relevant: "yes" },
      ],
      { version: 2 },
    );
    const message = (() => {
      try {
        readSearchLabels(path);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();

    expect(message).toMatch(/version is not 1/);
    expect(message).toMatch(/NCT00000001 appears more than once/);
    expect(message).toMatch(/labels\[2\]\.nctId is not an NCT ID/);
    expect(message).toMatch(/labels\[3\]\.set/);
    expect(message).toMatch(/NCT00000004\) is labelled but has no reason/);
    expect(message).toMatch(/NCT00000005\) has a reason but no label/);
    expect(message).toMatch(/labels\[6\]\.relevant is not true, false or null/);
  });
});

describe("completeLabels", () => {
  it("passes a fully labelled file and names the open ones otherwise", () => {
    expect(completeLabels(readSearchLabels(file([done])))).toHaveLength(1);
    expect(() => completeLabels(readSearchLabels(file([done, open])))).toThrow(
      /1 labels aren't filled in yet: NCT00000002/,
    );
  });
});
