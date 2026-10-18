/**
 * Fetches the search snapshot from ClinicalTrials.gov and writes it
 * (spec 0001 §2): every recruiting interventional cancer study with a US
 * site, trimmed, into `data/snapshot/<month>/`.
 *
 *   npm run snapshot:fetch              fetch and write the registry's current month
 *   npm run snapshot:fetch -- --dry-run compare with the committed snapshot, write nothing
 *   npm run snapshot:fetch -- --force   overwrite a snapshot already written for that month
 *
 * Run by a person, deliberately. The month comes from the registry's data
 * timestamp, never the clock. A snapshot already written for that month is
 * refused without `--force`, because labels and results are pinned to it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDataTimestamp, fetchSnapshotPage, SNAPSHOT_QUERY } from "../src/trials/registry.js";
import { DEFAULT_SNAPSHOT_DIR, loadSnapshot } from "../src/trials/snapshot-load.js";
import { trimSnapshotStudy } from "../src/trials/snapshot-trim.js";
import { MANIFEST_FILE, type SnapshotTrial } from "../src/trials/snapshot-types.js";
import { serializeSnapshot, writeSnapshot } from "../src/trials/snapshot-write.js";

const SNAPSHOT_ROOT = fileURLToPath(new URL("../data/snapshot", import.meta.url));
const PAUSE_MS = 1_500;
const SHOWN = 20;

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

/** Which trials were added, removed or changed between two snapshots, by NCT ID. */
export function compareSnapshots(
  before: readonly SnapshotTrial[],
  after: readonly SnapshotTrial[],
): SnapshotDiff {
  const lines = (trials: readonly SnapshotTrial[]) =>
    new Map(trials.map((t) => [t.nctId, serializeSnapshot([t])]));
  const a = lines(before);
  const b = lines(after);
  const sorted = (ids: Iterable<string>) => [...ids].sort();
  return {
    added: sorted([...b.keys()].filter((id) => !a.has(id))),
    removed: sorted([...a.keys()].filter((id) => !b.has(id))),
    changed: sorted([...b.keys()].filter((id) => a.has(id) && a.get(id) !== b.get(id))),
  };
}

export function describeDiff(diff: SnapshotDiff): string[] {
  const out: string[] = [];
  for (const [label, ids] of Object.entries(diff) as [keyof SnapshotDiff, string[]][]) {
    const more = ids.length > SHOWN ? ` and ${ids.length - SHOWN} more` : "";
    out.push(
      `  ${label}: ${ids.length}${ids.length > 0 ? `  ${ids.slice(0, SHOWN).join(" ")}${more}` : ""}`,
    );
  }
  return out;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const started = Date.now();

  const dataTimestamp = await fetchDataTimestamp();
  const month = dataTimestamp.slice(0, 7);
  const target = join(SNAPSHOT_ROOT, month);
  console.log(`Registry data of ${dataTimestamp}; snapshot ${month}`);

  if (!dryRun && !force && existsSync(join(target, MANIFEST_FILE))) {
    console.error(
      `A snapshot for ${month} already exists in ${target}. Labels and results are pinned to it.\n` +
        "Use --dry-run to see what changed, or --force to overwrite it deliberately.",
    );
    process.exitCode = 1;
    return;
  }

  const trials: SnapshotTrial[] = [];
  let token: string | null = null;
  let page = 0;
  do {
    if (page > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    const result = await fetchSnapshotPage(token);
    page++;
    result.studies.forEach((study, i) => {
      trials.push(trimSnapshotStudy(study, `page ${page}, study ${i + 1}`));
    });
    console.log(`  page ${page}: ${result.studies.length} studies (${trials.length} so far)`);
    token = result.nextPageToken;
  } while (token !== null);

  if (dryRun) {
    const committed = loadSnapshot(DEFAULT_SNAPSHOT_DIR);
    const diff = compareSnapshots(committed.trials, trials);
    console.log(
      `\nAgainst the committed snapshot (${committed.manifest.month}, ${committed.trials.length} trials):`,
    );
    for (const line of describeDiff(diff)) console.log(line);
    console.log("Dry run: nothing written.");
    if (diff.added.length + diff.removed.length + diff.changed.length > 0) process.exitCode = 1;
    return;
  }

  const manifest = writeSnapshot(target, trials, { dataTimestamp, query: SNAPSHOT_QUERY });
  console.log(
    `\nWrote ${manifest.count} trials to ${target}\n  sha256 ${manifest.sha256}\n  in ${Math.round((Date.now() - started) / 1000)} s`,
  );
}

// Only when run as a script, so tests can import compareSnapshots.
if (import.meta.main) {
  await main();
}
