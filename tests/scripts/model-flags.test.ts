// Copied from the prescreening repository's tests/scripts/model-flags.test.ts in slice 0002,
// without its block on that repository's eval scripts. `tests/scripts/facts-map.test.ts`
// tests this repository's one paid script's plan.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_CALLS,
  DEFAULT_MAX_USD,
  logSpend,
  planPaidRun,
  readModelFlags,
  roleLine,
} from "../../scripts/lib/model-flags.js";
import { createAdapter, parseModelSpec } from "../../src/models/index.js";
import { anthropicExpected, fixtureFetch, loadFixture, SENTINEL_KEY } from "../models/fixtures.js";

function emptyLog(): string {
  return join(mkdtempSync(join(tmpdir(), "spend-")), "spend.jsonl");
}

const SMALL = {
  expected: { calls: 10, inputTokens: 10_000, outputTokens: 1_000 },
  perCallCeiling: { inputTokens: 2_000, outputTokens: 256 },
};

describe("readModelFlags", () => {
  it("defaults every role to oMLX, dry, with the default caps", () => {
    const flags = readModelFlags([], ["agent", "participant", "fidelity"]);
    expect(flags.roles).toEqual({
      agent: { provider: "omlx" },
      participant: { provider: "omlx" },
      fidelity: { provider: "omlx" },
    });
    expect(flags).toMatchObject({
      spend: false,
      maxCalls: DEFAULT_MAX_CALLS,
      maxUsd: DEFAULT_MAX_USD,
      batch: false,
    });
    expect([DEFAULT_MAX_CALLS, DEFAULT_MAX_USD]).toEqual([100, 1]);
  });

  it("reads each role independently, and the budget flags", () => {
    const flags = readModelFlags(
      [
        "--agent",
        "anthropic",
        "--fidelity",
        "xai",
        "--spend",
        "--max-calls",
        "20",
        "--max-usd",
        "0.5",
      ],
      ["agent", "participant", "fidelity"],
    );
    expect(flags.roles["agent"]).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
    expect(flags.roles["participant"]).toEqual({ provider: "omlx" });
    expect(flags.roles["fidelity"]).toEqual({ provider: "xai", model: "grok-4.3" });
    expect(flags).toMatchObject({ spend: true, maxCalls: 20, maxUsd: 0.5 });
  });

  it("stops at a typo before anything is estimated", () => {
    expect(() => readModelFlags(["--model", "antropic"], ["model"])).toThrow(/unknown provider/);
    expect(() => readModelFlags(["--model"], ["model"])).toThrow(/needs a value/);
    expect(() => readModelFlags(["--max-calls", "2.5"], ["model"])).toThrow(/whole number/);
    expect(() => readModelFlags(["--max-usd", "-1"], ["model"])).toThrow(/positive/);
  });
});

describe("planPaidRun", () => {
  const flags = (argv: string[]) => readModelFlags(argv, ["model"]);

  it("is local, with nothing to estimate, when no role is paid", () => {
    expect(
      planPaidRun({
        flags: flags([]),
        paid: [{ role: "parser", spec: parseModelSpec("omlx"), workload: SMALL }],
        scope: "x",
        spendLog: emptyLog(),
      }),
    ).toEqual({ kind: "local" });
  });

  // The rule the whole slice rests on.
  it("is dry without --spend, and says how to spend", () => {
    const plan = planPaidRun({
      flags: flags(["--model", "anthropic"]),
      paid: [{ role: "parser", spec: parseModelSpec("anthropic"), workload: SMALL }],
      scope: "one study",
      spendLog: emptyLog(),
    });
    expect(plan.kind).toBe("estimate-only");
    expect(plan.kind === "estimate-only" && plan.text).toMatch(/Dry run: nothing was sent/);
  });

  it("spends with --spend, carrying the budget", () => {
    const plan = planPaidRun({
      flags: flags(["--model", "anthropic", "--spend", "--max-calls", "50"]),
      paid: [{ role: "parser", spec: parseModelSpec("anthropic"), workload: SMALL }],
      scope: "one study",
      spendLog: emptyLog(),
    });
    expect(plan).toMatchObject({ kind: "spend", budget: { maxCalls: 50, maxUsd: 1 } });
  });

  it("refuses to spend when the expected cost is over --max-usd", () => {
    const plan = planPaidRun({
      flags: flags(["--model", "anthropic", "--spend", "--max-usd", "0.01"]),
      paid: [{ role: "parser", spec: parseModelSpec("anthropic"), workload: SMALL }],
      scope: "one study",
      spendLog: emptyLog(),
    });
    expect(plan.kind).toBe("refused");
    expect(plan.kind === "refused" && plan.text).toMatch(/over --max-usd \$0\.010/);
  });

  // A run the cap would cut short is said to be one, and isn't started paid.
  it("says when the cap would stop a run partway, and refuses to spend on it", () => {
    const big = { ...SMALL, expected: { ...SMALL.expected, calls: 500 } };
    const dry = planPaidRun({
      flags: flags(["--model", "openai"]),
      paid: [{ role: "parser", spec: parseModelSpec("openai"), workload: big }],
      scope: "many",
      spendLog: emptyLog(),
    });
    expect(dry.kind === "estimate-only" && dry.text).toMatch(/would stop this run partway/);

    const paid = planPaidRun({
      flags: flags(["--model", "openai", "--spend"]),
      paid: [{ role: "parser", spec: parseModelSpec("openai"), workload: big }],
      scope: "many",
      spendLog: emptyLog(),
    });
    expect(paid.kind).toBe("refused");
  });
});

describe("role lines and the spend log", () => {
  it("says what each role runs on, and that a local one is free", () => {
    expect(roleLine("agent", parseModelSpec("anthropic:claude-sonnet-5"))).toMatch(
      /anthropic:claude-sonnet-5 \(temperature not settable \(rejected by claude-sonnet-5.*seed none/,
    );
    expect(roleLine("fidelity", parseModelSpec("omlx"))).toMatch(/omlx .*local, free/);
  });

  it("logs one line per paid adapter that spent, once even when roles share it", async () => {
    const log = emptyLog();
    const fixture = loadFixture("anthropic", "ask-ok");
    const { fetchImpl } = fixtureFetch(fixture);
    const usage = anthropicExpected(fixture.body).usage;
    const spec = parseModelSpec("anthropic");
    const adapter = createAdapter(spec, {
      env: { ANTHROPIC_API_KEY: SENTINEL_KEY },
      budget: { maxCalls: 5, maxUsd: 1 },
      fetchImpl,
    });
    await adapter.complete({ system: "s", user: "u", responseFormat: "json", maxOutputTokens: 8 });

    const total = logSpend(
      "eval:screening",
      [
        { role: "agent", spec, adapter },
        { role: "fidelity", spec, adapter },
      ],
      { batch: false, spendLog: log },
    );
    const lines = readFileSync(log, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      script: "eval:screening",
      role: "agent",
      spec: "anthropic:claude-haiku-4-5",
      calls: 1,
      ...usage,
    });
    expect(total).toBeCloseTo((usage.inputTokens * 1 + usage.outputTokens * 5) / 1_000_000, 12);
    expect(readFileSync(log, "utf8")).not.toContain(SENTINEL_KEY);
  });
});
