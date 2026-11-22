/**
 * Turns the demo's recording into the README's loop (slice 0014).
 *
 *   npm run demo                  docs/images/demo.gif, from e2e/.out/demo/cuts.json
 *   npm run demo -- --offset 0.3  shift every cut later by 0.3 s, if the video lags the marks
 *   npm run demo -- --mp4         also e2e/.out/demo/demo.mp4, never committed
 *
 * `npm run screenshots` records made-up patient p08 on `--fake` and writes the
 * cut list (`e2e/screenshots/demo.shots.ts`): the stretches of questions the
 * loop skips through are marked, and each is sped up here to last a couple of
 * seconds, visibly a fast-forward; everything else plays as recorded. This
 * trims, speeds and joins those pieces with `ffmpeg`, then makes a looping GIF
 * with its own palette. If the GIF is over 5 MB it tries a lower frame rate,
 * then narrower widths.
 *
 * Ported from the prescreening repository's `scripts/make-demo.ts` (its slice
 * 0016), where the marked stretches are waits on a model. Nothing waits here.
 *
 * `ffmpeg` is a system tool, not a dependency, and is needed for this only.
 * No network, no model, and nothing imported from the repository
 * (`tests/boundary.test.ts`).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** A piece of the recording, in seconds, played back `speed` times faster. */
export interface Cut {
  from: number;
  to: number;
  speed: number;
}

/** A moment the capture noted, in seconds from the start of the recording. */
export interface Mark {
  at: number;
  label: "fast-start" | "fast-end";
}

/** How long a fast-forward lasts in the loop, in seconds. */
export const FAST_SECONDS = 2.5;
export const MAX_BYTES = 5 * 1024 * 1024;
export const ATTEMPTS = [
  { fps: 12, width: 960 },
  { fps: 10, width: 960 },
  { fps: 10, width: 800 },
  { fps: 10, width: 720 },
] as const;
/** The MP4's width: it's small enough at full quality that no steps are needed. */
export const MP4_WIDTH = 960;

const CUTS_FILE = fileURLToPath(new URL("../e2e/.out/demo/cuts.json", import.meta.url));
const OUT = fileURLToPath(new URL("../docs/images/demo.gif", import.meta.url));
const MP4_OUT = fileURLToPath(new URL("../e2e/.out/demo/demo.mp4", import.meta.url));

/**
 * The cut list for a recording of `end` seconds, from `start` (to leave out
 * the blank frames before the page first shows): as recorded outside the
 * marks, and each marked stretch sped up to last `FAST_SECONDS`. Marks come in
 * pairs, a start then an end; anything else is an error in the capture.
 */
export function cutsFromMarks(marks: Mark[], end: number, start = 0): Cut[] {
  const cuts: Cut[] = [];
  let at = start;
  for (let i = 0; i < marks.length; i += 2) {
    const first = marks[i];
    const last = marks[i + 1];
    if (
      first?.label !== "fast-start" ||
      last?.label !== "fast-end" ||
      last.at < first.at ||
      first.at < start
    ) {
      throw new Error(`marks ${i} and ${i + 1} aren't a fast-forward's start and end`);
    }
    if (first.at > at) {
      cuts.push({ from: at, to: first.at, speed: 1 });
    }
    const length = last.at - first.at;
    if (length > 0) {
      cuts.push({ from: first.at, to: last.at, speed: Math.max(1, length / FAST_SECONDS) });
    }
    at = last.at;
  }
  if (end > at) {
    cuts.push({ from: at, to: end, speed: 1 });
  }
  return cuts;
}

/** How long the cut list plays, in seconds. */
export function cutLength(cuts: Cut[]): number {
  return cuts.reduce((sum, c) => sum + (c.to - c.from) / c.speed, 0);
}

const round = (n: number) => Number(n.toFixed(3));

/** Trims and speeds each cut, then joins them, ending at `[joined]`. */
function joined(cuts: Cut[], offset: number): string[] {
  const pieces = cuts.map(
    (c, i) =>
      `[0:v]trim=start=${round(Math.max(0, c.from + offset))}:end=${round(c.to + offset)},` +
      `setpts=(PTS-STARTPTS)/${round(c.speed)}[v${i}]`,
  );
  const inputs = cuts.map((_, i) => `[v${i}]`).join("");
  return [...pieces, `${inputs}concat=n=${cuts.length}:v=1:a=0`];
}

/** The `ffmpeg` filter graph that cuts, speeds, joins and paints the GIF. */
export function filterGraph(cuts: Cut[], fps: number, width: number, offset = 0): string {
  const parts = joined(cuts, offset);
  const concat = parts.pop();
  return [
    ...parts,
    `${concat},fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b]`,
    "[a]palettegen=stats_mode=diff[p]",
    "[b][p]paletteuse=dither=bayer:bayer_scale=4",
  ].join(";");
}

/** The `ffmpeg` arguments for the MP4: the same cuts, H.264, playable anywhere. */
export function mp4Args(video: string, cuts: Cut[], out: string, offset = 0): string[] {
  const parts = joined(cuts, offset);
  const concat = parts.pop();
  const graph = [...parts, `${concat},scale=${MP4_WIDTH}:-2:flags=lanczos`].join(";");
  return [
    "-y",
    "-loglevel",
    "error",
    "-i",
    video,
    "-filter_complex",
    graph,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    out,
  ];
}

function requireFfmpeg(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg isn't on the path. Install it (brew install ffmpeg) and try again.");
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const at = args.indexOf("--offset");
  const offset = at === -1 ? 0 : Number(args[at + 1]);
  if (!Number.isFinite(offset)) {
    throw new Error("--offset takes a number of seconds");
  }
  requireFfmpeg();
  const { video, cuts } = JSON.parse(readFileSync(CUTS_FILE, "utf8")) as {
    video: string;
    cuts: Cut[];
  };
  const seconds = cutLength(cuts).toFixed(1);
  let made = false;
  for (const attempt of ATTEMPTS) {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        video,
        "-filter_complex",
        filterGraph(cuts, attempt.fps, attempt.width, offset),
        "-loop",
        "0",
        OUT,
      ],
      { stdio: "inherit" },
    );
    const bytes = statSync(OUT).size;
    const mb = (bytes / 1024 / 1024).toFixed(2);
    console.log(
      `${OUT}: ${bytes} bytes (${mb} MB), ${seconds} s at ${attempt.fps} fps, ${attempt.width} px wide`,
    );
    if (bytes <= MAX_BYTES) {
      made = true;
      break;
    }
  }
  if (!made) {
    throw new Error("Still over 5 MB at the smallest setting. Shorten the demo in the capture.");
  }
  if (args.includes("--mp4")) {
    execFileSync("ffmpeg", mp4Args(video, cuts, MP4_OUT, offset), { stdio: "inherit" });
    console.log(`${MP4_OUT}: ${statSync(MP4_OUT).size} bytes, not for committing`);
  }
}

if (import.meta.main) {
  main();
}
