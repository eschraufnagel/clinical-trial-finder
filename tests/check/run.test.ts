import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findParse,
  parseCacheName,
  parseWithCache,
  readCachedParse,
} from "../../src/check/parse-cache.js";
import { recordOf, startCheck } from "../../src/check/run.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { FakeModelAdapter } from "../../src/models/index.js";
import { TAP_WORDS, tapReading } from "../../src/screening/taps.js";
import { getTrial } from "../../src/trials/index.js";

/**
 * A check from code: parse (or the cache), link, carry, session, record, on
 * the fake adapter and a real pinned protocol, so quotes resolve against
 * real text.
 */

const TRIAL = getTrial("NCT04316364");
const TEXT = TRIAL.eligibility.criteriaText;
const ECOG = "Eastern Cooperative Oncology Group (ECOG) performance status 0 or 1";
const CONTRACEPTION =
  "Women of childbearing age without sterilizing or male, must agree to use contraception";

const parseResponse = () =>
  new FakeModelAdapter([
    {
      kind: "json",
      content: {
        criteria: [
          {
            quote: ECOG,
            text: "ECOG 0 or 1",
            polarity: "inclusion",
            type: "clinical",
            confidence: 0.9,
          },
          {
            quote: CONTRACEPTION,
            text: "Agrees to use contraception",
            polarity: "inclusion",
            type: "patient",
            confidence: 0.9,
          },
        ],
      },
    },
  ]);

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("parseWithCache", () => {
  it("parses once, then reads the cache", async () => {
    const dir = tempDir();
    const first = await parseWithCache(TRIAL, parseResponse(), dir);
    expect(first.source).toBe("model");
    const second = await parseWithCache(TRIAL, new FakeModelAdapter([]), dir);
    expect(second.source).toBe("cache");
    expect(second.parsed.criteria).toEqual(first.parsed.criteria);
  });

  it("misses for another model, and for changed text", async () => {
    const dir = tempDir();
    const { parsed } = await parseWithCache(TRIAL, parseResponse(), dir);
    const other = new FakeModelAdapter([], { descriptor: { model: "another" } });
    expect(parseCacheName(TRIAL.nctId, other.descriptor)).not.toBe(
      parseCacheName(TRIAL.nctId, parseResponse().descriptor),
    );
    const path = join(dir, parseCacheName(TRIAL.nctId, parseResponse().descriptor));
    expect(readCachedParse(path, TEXT)).toEqual(parsed);
    expect(readCachedParse(path, `${TEXT} changed`)).toBeUndefined();
  });

  it("treats a corrupt file as a miss, and finds a run's parse by trial", async () => {
    const dir = tempDir();
    await parseWithCache(TRIAL, parseResponse(), dir);
    expect(findParse(dir, TRIAL.nctId, TEXT)?.nctId).toBe(TRIAL.nctId);
    expect(findParse(dir, "NCT99999999", TEXT)).toBeUndefined();
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{", "utf8");
    expect(readCachedParse(broken, TEXT)).toBeUndefined();
  });
});

describe("startCheck", () => {
  const span = (quote: string) => {
    const start = TEXT.indexOf(quote);
    return { start, end: start + quote.length, text: quote };
  };
  const mapping: FactMapping = {
    factId: "ecog",
    rulesOut: ["ps2", "ps3_4"],
    polarity: "inclusion",
    source: span(ECOG),
  };
  const facts: TrialFacts = {
    nctId: TRIAL.nctId,
    mappings: [mapping],
    rejected: [],
    run: {
      model: "fake",
      quantization: "none",
      temperature: 0,
      seed: 0,
      adapter: "fake",
      promptVersion: "x",
      timestamp: "2000-06",
      vocabularySha256: "x",
      normalizeVersion: "2",
      snapshotMonth: "2000-06",
      cancerType: "nsclc",
    },
  };

  it("carries the conversation's answer onto the linked rule, and asks only the rest", async () => {
    const { parsed } = await parseWithCache(TRIAL, parseResponse(), tempDir());
    const check = startCheck({
      study: { nctId: TRIAL.nctId, briefTitle: TRIAL.briefTitle },
      criteriaText: TEXT,
      parsed,
      facts,
      answers: new Map([
        ["ecog", { answer: "ps2", words: "I rest half the day.", question: "Asked before?" }],
      ]),
      adapter: new FakeModelAdapter([]),
      fixedQuestions: true,
    });

    expect(check.carried["P1"]).toEqual([
      {
        factId: "ecog",
        answer: "ps2",
        words: "I rest half the day.",
        question: "Asked before?",
        mayNotFit: true,
      },
    ]);
    const opening = await check.session.start();
    expect(opening.text).toMatch(/covered 1 of its rules/);
    expect(opening.text).toMatch(/Agrees to use contraception/);

    const reply = await check.session.apply(TAP_WORDS.yes, [tapReading("P2", "yes")]);
    if (reply.kind !== "done") throw new Error("expected the check to end");
    const record = recordOf(check, reply.result);
    expect(record.earlier.lines[0]).toMatchObject({
      mayNotFit: true,
      rule: { registry: ECOG },
      earlier: [{ asked: { ours: "Asked before?" }, said: { said: "I rest half the day." } }],
      said: [],
    });
    expect(record.told.lines[0]).toMatchObject({
      mayNotFit: false,
      rule: { registry: CONTRACEPTION },
    });
  });

  it("with no mappings, carries nothing and asks everything", async () => {
    const { parsed } = await parseWithCache(TRIAL, parseResponse(), tempDir());
    const check = startCheck({
      study: { nctId: TRIAL.nctId, briefTitle: TRIAL.briefTitle },
      criteriaText: TEXT,
      parsed,
      facts: undefined,
      answers: new Map([["ecog", { answer: "ps1", words: "Fine.", question: "Asked before?" }]]),
      adapter: new FakeModelAdapter([]),
      fixedQuestions: true,
    });
    expect(check.carried).toEqual({});
    expect((await check.session.start()).text).toMatch(/ECOG 0 or 1/);
  });
});
