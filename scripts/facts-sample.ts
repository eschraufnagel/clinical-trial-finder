/**
 * Draws the trials 0002's fact labels are written for, and writes a skeleton
 * for each (spec 0002 §5.1).
 *
 *   npm run facts:sample
 *
 * The NSCLC candidates ordered by `sha256("0002:" + nctId)`: the first 10 are
 * the dev set, the next 30 the held-out set. Each skeleton holds the trial's
 * passages, every one unlabelled. Refuses to write if any label file exists,
 * so a label is never overwritten by a fresh skeleton.
 *
 * Can't see the mapper: it reaches `src/facts/` only for the vocabulary and
 * its types, and no model (`tests/boundary.test.ts`).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  criteriaTextSha,
  FACT_LABELS_DIR,
  type FactLabelSet,
  type FactLabels,
} from "../evals/facts/labels.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadVocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";
import { candidateIds } from "./facts-candidates.js";
import { splitPassages } from "./label-criteria.js";

export const DEV_SIZE = 10;
export const HELDOUT_SIZE = 30;

export function drawSample(ids: readonly string[]): { dev: string[]; heldout: string[] } {
  const ordered = [...ids].sort((a, b) => {
    const ha = order(a);
    const hb = order(b);
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  return {
    dev: ordered.slice(0, DEV_SIZE),
    heldout: ordered.slice(DEV_SIZE, DEV_SIZE + HELDOUT_SIZE),
  };
}

export function skeleton(
  trial: SnapshotTrial,
  set: FactLabelSet,
  vocabularySha256: string,
): FactLabels {
  const text = trial.eligibility.criteriaText;
  return {
    nctId: trial.nctId,
    set,
    criteriaTextSha: criteriaTextSha(text),
    vocabularySha256,
    passages: splitPassages(text).map(({ quote, start, end }) => ({
      quote,
      start,
      end,
      mappings: [],
      unmapped: null,
    })),
  };
}

function order(nctId: string): string {
  return createHash("sha256").update(`0002:${nctId}`).digest("hex");
}

function main(): void {
  mkdirSync(FACT_LABELS_DIR, { recursive: true });
  if (readdirSync(FACT_LABELS_DIR).some((n) => /^NCT\d{8}\.json$/.test(n))) {
    console.error(`${FACT_LABELS_DIR} already has label files. Nothing written.`);
    process.exitCode = 1;
    return;
  }
  const { trials } = loadSnapshot();
  const byId = new Map(trials.map((t) => [t.nctId, t]));
  const facts = loadFactVocabulary();
  const { dev, heldout } = drawSample(candidateIds(trials, loadVocabulary("nsclc")));
  for (const [set, ids] of [
    ["dev", dev],
    ["heldout", heldout],
  ] as const) {
    for (const id of ids) {
      const trial = byId.get(id);
      if (trial === undefined) throw new Error(`${id} isn't in the snapshot`);
      const labels = skeleton(trial, set, facts.sha256);
      writeFileSync(
        join(FACT_LABELS_DIR, `${id}.json`),
        `${JSON.stringify(labels, null, 2)}\n`,
        "utf8",
      );
    }
  }
  console.log(`Wrote ${dev.length} dev and ${heldout.length} held-out skeletons.`);
  console.log(`Dev: ${dev.join(" ")}`);
  console.log(`Held-out: ${heldout.join(" ")}`);
}

if (import.meta.main) {
  main();
}
