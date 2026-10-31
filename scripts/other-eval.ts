/**
 * Slice 0005's measurement of trials for other cancers (spec 0005 §4.6).
 *
 *   npm run other:eval -- --dev                 score every route on the dev labels, and write a result
 *   npm run other:eval                          score every route on the held-out labels, once (plan step 9)
 *   npm run other:eval -- --check [--dev]       rerun the latest result and fail on any difference
 *   npm run other:eval -- --places <result>     short-list places held by trials not for NSCLC
 *
 * Every route is scored on its own, whatever the others file adopts. Dev is
 * 0001's labels and `places-dev`; held-out is `places-heldout` and `sample`.
 * Deterministic: no model, no network, so a result names checksums rather
 * than a model, quantization, temperature or seed.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { nextRunFile } from "../evals/run-file.js";
import {
  labelsSha256,
  NSCLC_LABELS,
  OTHER_LABELS,
  OTHER_SETS,
  readSearchLabels,
  type SearchLabel,
} from "../evals/search/labels.js";
import {
  type PlacesRow,
  passesBar,
  placesHeld,
  type RouteRow,
  type RouteSummary,
  scoreRoutes,
  summarizePlaces,
} from "../evals/search/other.js";
import { loadOthers, ROUTES, routesFor } from "../src/search/other.js";
import { loadVocabulary, reasonsFor } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import { isTreatment } from "./search-sample.js";

export const RESULTS_DIR = fileURLToPath(new URL("../evals/results/search/other", import.meta.url));

const DEV_SETS = ["0001:heldout", "0001:dev", "places-dev"];
const HELDOUT_SETS = ["places-heldout", "sample"];

export interface OtherEvalResult {
  version: 1;
  cancerType: string;
  snapshot: { month: string; sha256: string };
  vocabularySha256: string;
  othersSha256: string;
  labelsSha256: { nsclc: string; other: string };
  /** The routes the others file adopted when this ran. Every route is scored regardless. */
  adopted: string[];
  sets: string[];
  /** Labelled trials the search keeps for the type: the only ones a route can mark. */
  rows: RouteRow[];
  /** Per set, then every set together, as `all`. */
  summaries: Record<string, RouteSummary[]>;
  /** Held-out only: each route against the bar on `sample` (spec §7). */
  bar: Record<string, boolean> | null;
}

type AnyLabel = Omit<SearchLabel, "set"> & { set: string };

/** 0001's labels carry 0001's set names; they're prefixed so they can't be mistaken for 0005's. */
function allLabels(): AnyLabel[] {
  return [
    ...readSearchLabels(NSCLC_LABELS).labels.map((l) => ({ ...l, set: `0001:${l.set}` })),
    ...readSearchLabels(OTHER_LABELS, OTHER_SETS).labels,
  ];
}

export function scoreSets(sets: readonly string[]): OtherEvalResult {
  const { manifest, trials } = loadSnapshot();
  const vocabulary = loadVocabulary("nsclc");
  const others = loadOthers("nsclc");
  if (others === null) throw new Error("No data/cancer-types/nsclc-others.json.");
  const byId = new Map(trials.map((t) => [t.nctId, t]));

  const rows: RouteRow[] = [];
  for (const label of allLabels()) {
    if (!sets.includes(label.set)) continue;
    if (label.relevant === null) throw new Error(`${label.nctId} isn't labelled yet.`);
    const trial = byId.get(label.nctId);
    if (trial === undefined)
      throw new Error(`${label.nctId} is labelled but isn't in the snapshot.`);
    if (!isTreatment(trial) || reasonsFor(trial, vocabulary).length === 0) continue;
    rows.push({
      nctId: label.nctId,
      set: label.set,
      relevant: label.relevant,
      unclear: label.reason.startsWith("unclear"),
      routes: routesFor(trial, vocabulary, others).map((r) => r.route),
    });
  }

  const summaries: Record<string, RouteSummary[]> = {};
  for (const set of sets)
    summaries[set] = scoreRoutes(
      rows.filter((r) => r.set === set),
      ROUTES,
    );
  summaries["all"] = scoreRoutes(rows, ROUTES);
  const sample = summaries["sample"];
  return {
    version: 1,
    cancerType: "nsclc",
    snapshot: { month: manifest.month, sha256: manifest.sha256 },
    vocabularySha256: vocabulary.sha256,
    othersSha256: others.sha256,
    labelsSha256: { nsclc: labelsSha256(NSCLC_LABELS), other: labelsSha256(OTHER_LABELS) },
    adopted: [...others.routes],
    sets: [...sets],
    rows,
    summaries,
    bar:
      sample === undefined
        ? null
        : Object.fromEntries(
            sample.filter((s) => s.route !== "any").map((s) => [s.route, passesBar(s)]),
          ),
  };
}

export function latestResultFile(dir: string): string | undefined {
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => /^\d+-[0-9a-f]+\.json$/.test(name));
  } catch {
    return undefined;
  }
  names.sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const last = names.at(-1);
  return last === undefined ? undefined : join(dir, last);
}

function describe(result: OtherEvalResult): string {
  const lines = [`${result.rows.length} labelled candidates in ${result.sets.join(", ")}`];
  for (const s of result.summaries["all"] ?? []) {
    lines.push(
      `  ${s.route.padEnd(11)} gains ${String(s.markedNotRelevant.length).padStart(3)}   costs ${s.markedRelevant.length} (${s.markedRelevant.join(" ") || "none"})   unclear ${s.markedRelevantUnclear.length} (${s.markedRelevantUnclear.join(" ") || "none"})   left ${s.unmarkedNotRelevant.length}`,
    );
  }
  if (result.bar !== null) {
    lines.push(
      `  bar on sample: ${Object.entries(result.bar)
        .map(([r, ok]) => `${r} ${ok ? "passes" : "fails"}`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

function places(path: string): void {
  const result = JSON.parse(readFileSync(path, "utf8")) as { rows?: PlacesRow[] };
  if (!Array.isArray(result.rows)) throw new Error(`${path} has no rows.`);
  const labels = [
    ...readSearchLabels(NSCLC_LABELS).labels,
    ...readSearchLabels(OTHER_LABELS, OTHER_SETS).labels,
  ];
  const held = placesHeld(result.rows, labels);

  console.log(`Short-list places held by trials labelled not for NSCLC, in ${path}\n`);
  console.log(
    "set      arm           scorer      patients  places  not NSCLC  patients with any  unlabelled",
  );
  for (const s of summarizePlaces(held)) {
    console.log(
      [
        s.set.padEnd(8),
        s.arm.padEnd(13),
        (s.scorer ?? "—").padEnd(11),
        String(s.patients).padStart(8),
        String(s.places).padStart(7),
        String(s.notRelevant).padStart(10),
        String(s.patientsWithAny).padStart(18),
        String(s.unlabelled).padStart(11),
      ].join(" "),
    );
  }

  const counts = new Map<string, number>();
  for (const row of held)
    for (const id of row.notRelevant) counts.set(id, (counts.get(id) ?? 0) + 1);
  console.log("\nTrials labelled not for NSCLC, by places held across every row:");
  for (const [id, n] of [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
    console.log(`  ${id}  ${n}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const at = args.indexOf("--places");
  if (at >= 0) {
    const path = args[at + 1];
    if (path === undefined) {
      console.error("Usage: npm run other:eval -- --places <questions result>");
      process.exitCode = 1;
      return;
    }
    places(path);
    return;
  }

  const dev = args.includes("--dev");
  const dir = dev ? join(RESULTS_DIR, "dev") : RESULTS_DIR;
  const sets = dev ? DEV_SETS : HELDOUT_SETS;

  if (args.includes("--check")) {
    const file = latestResultFile(dir);
    if (file === undefined) {
      console.error(`No committed result in ${dir} to check.`);
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(file, "utf8")) as OtherEvalResult;
    const rerun = scoreSets(committed.sets);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const problems = [
      ...(
        [
          "snapshot",
          "vocabularySha256",
          "othersSha256",
          "labelsSha256",
          "rows",
          "summaries",
          "bar",
        ] as const
      )
        .filter((key) => !same(rerun[key], committed[key]))
        .map((key) => `${key} differs`),
    ];
    if (problems.length > 0) {
      console.error(`${file} doesn't match a rerun: ${problems.join(", ")}.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${file} matches a rerun, row for row.`);
    return;
  }

  if (!dev && latestResultFile(dir) !== undefined) {
    console.error(
      `Held-out is scored once, and ${latestResultFile(dir)} exists. Use --check to rerun it.`,
    );
    process.exitCode = 1;
    return;
  }
  const result = scoreSets(sets);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nextRunFile(dir, result.othersSha256.slice(0, 12)));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path}`);
  console.log(describe(result));
}

if (import.meta.main) {
  main();
}
