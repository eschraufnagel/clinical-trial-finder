import { describe, expect, it } from "vitest";
import { containsTerm, normalizeText } from "../../src/search/normalize.js";

describe("normalizeText", () => {
  it("lowercases, turns every run of non-letters into one space, and pads", () => {
    expect(normalizeText("Non-Small-Cell Lung Cancer (NSCLC),")).toBe(
      " non small cell lung cancer nsclc ",
    );
    expect(normalizeText("  KRAS  G12C\n")).toBe(" kras g12c ");
    expect(normalizeText("Tumöre")).toBe(" tumöre ");
  });

  it("gives a single space for text with no words", () => {
    expect(normalizeText("— , ;")).toBe(" ");
  });
});

describe("containsTerm", () => {
  const text = normalizeText("Carcinoma, Non-Small-Cell Lung; NSCLC, stage IV");

  it("matches whole words however they were punctuated", () => {
    expect(containsTerm(text, "non small cell lung")).toBe(true);
    expect(containsTerm(text, "Non-Small-Cell")).toBe(true);
    expect(containsTerm(text, "nsclc")).toBe(true);
  });

  it("doesn't match inside a longer word, or an empty term", () => {
    expect(containsTerm(normalizeText("nsclcx"), "nsclc")).toBe(false);
    expect(containsTerm(normalizeText("sclc"), "nsclc")).toBe(false);
    expect(containsTerm(text, " - ")).toBe(false);
  });
});
