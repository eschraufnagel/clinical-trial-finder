import { describe, expect, it } from "vitest";
import {
  cutLength,
  cutsFromMarks,
  FAST_SECONDS,
  filterGraph,
  MP4_WIDTH,
  mp4Args,
} from "../../scripts/make-demo.js";

/** The README's loop (slice 0014), ported from the prescreening repository's. No ffmpeg runs. */
describe("the demo's cut list", () => {
  it("plays the recording as it was, with each fast-forward sped up to a couple of seconds", () => {
    const cuts = cutsFromMarks(
      [
        { at: 4, label: "fast-start" },
        { at: 34, label: "fast-end" },
        { at: 40, label: "fast-start" },
        { at: 46, label: "fast-end" },
      ],
      55,
    );
    expect(cuts).toEqual([
      { from: 0, to: 4, speed: 1 },
      { from: 4, to: 34, speed: 30 / FAST_SECONDS },
      { from: 34, to: 40, speed: 1 },
      { from: 40, to: 46, speed: 6 / FAST_SECONDS },
      { from: 46, to: 55, speed: 1 },
    ]);
  });

  it("is the whole recording in one piece when nothing is marked", () => {
    expect(cutsFromMarks([], 30)).toEqual([{ from: 0, to: 30, speed: 1 }]);
  });

  it("starts where it's told to, leaving out the blank frames before it", () => {
    const cuts = cutsFromMarks(
      [
        { at: 5, label: "fast-start" },
        { at: 15, label: "fast-end" },
      ],
      20,
      1.5,
    );
    expect(cuts[0]).toEqual({ from: 1.5, to: 5, speed: 1 });
    expect(cutsFromMarks([], 20, 1.5)).toEqual([{ from: 1.5, to: 20, speed: 1 }]);
  });

  it("handles a fast-forward at the very start or the very end", () => {
    expect(
      cutsFromMarks(
        [
          { at: 0, label: "fast-start" },
          { at: 10, label: "fast-end" },
        ],
        12,
      ),
    ).toEqual([
      { from: 0, to: 10, speed: 10 / FAST_SECONDS },
      { from: 10, to: 12, speed: 1 },
    ]);
    expect(
      cutsFromMarks(
        [
          { at: 2, label: "fast-start" },
          { at: 12, label: "fast-end" },
        ],
        12,
      ),
    ).toEqual([
      { from: 0, to: 2, speed: 1 },
      { from: 2, to: 12, speed: 10 / FAST_SECONDS },
    ]);
  });

  it("never slows a stretch shorter than a fast-forward", () => {
    const cuts = cutsFromMarks(
      [
        { at: 1, label: "fast-start" },
        { at: 1.2, label: "fast-end" },
      ],
      2,
    );
    expect(cuts[1]?.speed).toBe(1);
  });

  it("refuses marks that aren't start-end pairs, or that come before the start", () => {
    expect(() => cutsFromMarks([{ at: 1, label: "fast-end" }], 2)).toThrow();
    expect(() => cutsFromMarks([{ at: 1, label: "fast-start" }], 2)).toThrow();
    expect(() =>
      cutsFromMarks(
        [
          { at: 3, label: "fast-start" },
          { at: 2, label: "fast-end" },
        ],
        4,
      ),
    ).toThrow();
    expect(() =>
      cutsFromMarks(
        [
          { at: 1, label: "fast-start" },
          { at: 2, label: "fast-end" },
        ],
        4,
        1.5,
      ),
    ).toThrow();
  });

  it("says how long the loop plays", () => {
    expect(
      cutLength([
        { from: 0, to: 4, speed: 1 },
        { from: 4, to: 34, speed: 12 },
        { from: 34, to: 40, speed: 1 },
      ]),
    ).toBe(12.5);
  });
});

describe("the demo's filter graph", () => {
  it("trims and speeds each cut, joins them, and paints the GIF from its own palette", () => {
    const graph = filterGraph(
      [
        { from: 0, to: 4, speed: 1 },
        { from: 4, to: 34, speed: 12 },
      ],
      12,
      960,
    );
    expect(graph).toBe(
      [
        "[0:v]trim=start=0:end=4,setpts=(PTS-STARTPTS)/1[v0]",
        "[0:v]trim=start=4:end=34,setpts=(PTS-STARTPTS)/12[v1]",
        "[v0][v1]concat=n=2:v=1:a=0,fps=12,scale=960:-1:flags=lanczos,split[a][b]",
        "[a]palettegen=stats_mode=diff[p]",
        "[b][p]paletteuse=dither=bayer:bayer_scale=4",
      ].join(";"),
    );
  });

  it("shifts every cut by the offset, never before the start", () => {
    const graph = filterGraph([{ from: 0, to: 4, speed: 1 }], 10, 800, 0.25);
    expect(graph).toContain("trim=start=0.25:end=4.25");
    expect(filterGraph([{ from: 0, to: 4, speed: 1 }], 10, 800, -0.5)).toContain(
      "trim=start=0:end=3.5",
    );
  });
});

describe("the demo's MP4", () => {
  it("uses the same cuts, as H.264, with no palette", () => {
    const args = mp4Args("in.webm", [{ from: 0, to: 4, speed: 1 }], "out.mp4", 0.25);
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph).toBe(
      [
        "[0:v]trim=start=0.25:end=4.25,setpts=(PTS-STARTPTS)/1[v0]",
        `[v0]concat=n=1:v=1:a=0,scale=${MP4_WIDTH}:-2:flags=lanczos`,
      ].join(";"),
    );
    expect(args.slice(0, 5)).toEqual(["-y", "-loglevel", "error", "-i", "in.webm"]);
    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
    expect(args.at(-1)).toBe("out.mp4");
  });
});
