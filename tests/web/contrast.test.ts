import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA in light and dark, and on paper (spec 0011 §6). The page's colours
 * are set only as tokens in `styles.css`: light on `:root`, dark under
 * `prefers-color-scheme: dark`, and the light ones forced again for print.
 * Every pair the page draws text or a control with is held here to its
 * minimum, in each theme.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../../src/web/styles.css", import.meta.url)),
  "utf8",
);

type Tokens = Record<string, string>;

/** The `--name: #hex` declarations in the first block opened by `opener`. */
function tokensAfter(css: string, opener: RegExp): Tokens {
  const start = css.search(opener);
  if (start < 0) throw new Error(`no block ${opener}`);
  const open = css.indexOf("{", css.indexOf(":root", start));
  const close = css.indexOf("}", open);
  const tokens: Tokens = {};
  for (const m of css.slice(open, close).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) {
    tokens[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return tokens;
}

const LIGHT = tokensAfter(CSS, /^:root \{/m);
const DARK = { ...LIGHT, ...tokensAfter(CSS, /@media \(prefers-color-scheme: dark\)/) };
// Paper is printed from whichever theme the system is in, so print's forced
// tokens are checked over both.
const PRINTED = tokensAfter(CSS, /@media print/);
const THEMES: Record<string, Tokens> = {
  light: LIGHT,
  dark: DARK,
  "print from light": { ...LIGHT, ...PRINTED },
  "print from dark": { ...DARK, ...PRINTED },
};

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((x) => x + x).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => channel(Number.parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

/** WCAG's contrast ratio between two colours. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum, where it's used] */
const PAIRS: [string, string, number, string][] = [
  ["ink", "bg", 4.5, "body text on the page"],
  ["ink", "surface", 4.5, "cards, header, inputs, findings"],
  ["ink", "surface-2", 4.5, "group headers, the standing notice, the result line"],
  ["ink", "you", 4.5, "the person's own words"],
  ["ink-2", "surface", 4.5, "secondary text on cards"],
  ["ink-2", "surface-2", 4.5, "secondary text on group headers"],
  ["ink-2", "bg", 4.5, "earlier turns, the order note's page"],
  ["ink-2", "disabled", 4.5, "a disabled button's words"],
  ["placeholder", "surface", 4.5, "placeholders"],
  ["accent", "surface", 4.5, "links, the question label"],
  ["accent", "bg", 4.5, "links on the page"],
  ["on-accent", "accent", 4.5, "a primary button's words"],
  ["on-accent", "accent-hover", 4.5, "a primary button's words, hovered"],
  ["control-line", "surface", 3, "input and secondary button borders"],
  ["accent", "bg", 3, "the focus outline"],
  ["mark-lead", "ink", 3, "the mark's top line on its tile"],
  ["mark-line", "ink", 3, "the mark's lower lines on its tile"],
];

describe("the page's colours", () => {
  it("are read from the stylesheet's token blocks", () => {
    expect(Object.keys(LIGHT).length).toBeGreaterThan(15);
    expect(DARK.bg).not.toBe(LIGHT.bg);
    expect(THEMES["print from dark"]?.bg).toBe("#ffffff");
  });

  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`meet AA in ${theme}`, () => {
      const short = PAIRS.flatMap(([fg, bg, min, where]) => {
        const a = tokens[fg];
        const b = tokens[bg];
        if (a === undefined || b === undefined) return [`${fg} on ${bg}: missing`];
        const r = ratio(a, b);
        return r < min ? [`${fg} on ${bg} (${where}): ${r.toFixed(2)} < ${min}`] : [];
      });
      expect(short).toEqual([]);
    });
  }

  it("are set nowhere but as tokens", () => {
    const stray = CSS.split("\n")
      .map((line, i) => [line, i + 1] as const)
      .filter(([line]) => /#[0-9a-fA-F]{3,8}\b/.test(line.replace(/\/\*.*?\*\//g, "")))
      .filter(([line]) => !/^\s*--[a-z0-9-]+:\s*#[0-9a-fA-F]{3,8}\b/.test(line))
      .map(([line, n]) => `${n}: ${line.trim()}`);
    expect(stray).toEqual([]);
  });

  it("would catch a pair that falls short", () => {
    expect(ratio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});
