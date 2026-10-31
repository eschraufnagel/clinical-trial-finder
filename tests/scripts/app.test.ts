import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measuredModels, parseAppArgs, scriptedReader } from "../../scripts/app.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { READER_PROMPT_VERSION } from "../../src/questions/prompt.js";
import { readReply } from "../../src/questions/read.js";

const vocabulary = loadFactVocabulary();
const fact = (id: string) => {
  const f = vocabulary.facts.find((x) => x.id === id);
  if (f === undefined) throw new Error(id);
  return f;
};

/** A made-up yes/no fact and reply, read the way `answer` says. */
const FACT_ID = "pregnant_or_breastfeeding";
const REPLY = "Made up for a test.";

/** One reads file holding one reading, or one failed pair. */
function writeReads(
  dir: string,
  name: string,
  run: { model: string; adapter: string; schema?: "enforced"; promptVersion?: string },
  answer: string,
  options: { failed?: boolean } = {},
): void {
  const item = {
    patient: "p00",
    factId: FACT_ID,
    kind: "says",
    reply: REPLY,
    expected: answer,
    answer,
  };
  writeFileSync(
    join(dir, name),
    JSON.stringify({
      run: { promptVersion: READER_PROMPT_VERSION, ...run },
      items: options.failed === true ? [] : [item],
      failures: options.failed === true ? { [`p00:${FACT_ID}`]: "model output is not JSON" } : {},
    }),
  );
}

describe("npm run app", () => {
  it("reads its flags, refusing a port it can't use", () => {
    expect(parseAppArgs([])).toEqual({ port: 5025, fake: false, settingsDir: undefined });
    expect(parseAppArgs(["--fake", "--port", "5035", "--settings-dir", "x"])).toEqual({
      port: 5035,
      fake: true,
      settingsDir: "x",
    });
    expect(() => parseAppArgs(["--port", "80"])).toThrow(/--port/);
  });

  it("knows what each committed held-out reading run measured", () => {
    const byModel = new Map(measuredModels().map((m) => [m.model, m]));
    // The local model read every reply: 326 of 326 exactly, 1 of 201 don't-knows invented.
    expect(byModel.get("Qwen3.6-35B-A3B-MLX-8bit")).toEqual({
      model: "Qwen3.6-35B-A3B-MLX-8bit",
      readable: 1,
      exact: 1,
      invented: 1 / 201,
    });
    // Claude Haiku 4.5 with the schema enforced (slice 0006) read all 527:
    // 324 of 326 exactly, 0 of 201 invented. 0004's run without the schema
    // no longer counts, because the app doesn't send that request.
    expect(byModel.get("claude-haiku-4-5")).toEqual({
      model: "claude-haiku-4-5",
      readable: 1,
      exact: 324 / 326,
      invented: 0,
    });
  });

  it("counts only a run of the request the app would send, and refuses two", () => {
    const dir = mkdtempSync(join(tmpdir(), "reads-"));
    writeReads(dir, "heldout-local.json", { model: "local", adapter: "omlx" }, "yes");
    // 0004's kind of run, without the schema: not what the app sends Haiku.
    writeReads(
      dir,
      "heldout-haiku.json",
      { model: "claude-haiku-4-5", adapter: "anthropic" },
      "unknown",
      {
        failed: true,
      },
    );
    writeReads(
      dir,
      "heldout-haiku-schema.json",
      { model: "claude-haiku-4-5", adapter: "anthropic", schema: "enforced" },
      "yes",
    );
    // An older prompt, and a dev run: neither counts.
    writeReads(
      dir,
      "heldout-old.json",
      { model: "old", adapter: "omlx", promptVersion: "000000000000" },
      "yes",
    );
    writeReads(dir, "dev-dev.json", { model: "dev", adapter: "omlx" }, "yes");

    expect(measuredModels(dir).map((m) => [m.model, m.readable])).toEqual([
      ["claude-haiku-4-5", 1],
      ["local", 1],
    ]);

    writeReads(dir, "heldout-local-again.json", { model: "local", adapter: "omlx" }, "yes");
    expect(() => measuredModels(dir)).toThrow(/Two held-out reading runs measure local/);
  });

  it("with --fake, reads as the local model read, never as a hosted one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reads-"));
    writeReads(dir, "dev-local.json", { model: "local", adapter: "omlx" }, "yes");
    // Sorts after the local file, so it would win if it were read at all.
    writeReads(
      dir,
      "heldout-zz-hosted.json",
      { model: "claude-haiku-4-5", adapter: "anthropic" },
      "no",
    );
    const reader = scriptedReader(vocabulary, dir);
    const adapter = reader.forConversation(reader.current());
    expect((await readReply(fact(FACT_ID), REPLY, adapter)).answer).toBe("yes");
  });

  it("with --fake, reads a made-up patient's reply as the local model read it, and anything else as unknown", async () => {
    const reader = scriptedReader(vocabulary);
    const adapter = reader.forConversation(reader.current());
    // p01's reply, as committed in the held-out reads.
    expect(
      (await readReply(fact("histology"), "The biopsy said adenocarcinoma.", adapter)).answer,
    ).toBe("adenocarcinoma");
    expect((await readReply(fact("histology"), "Something nobody wrote.", adapter)).answer).toBe(
      "unknown",
    );
    // The same words to another question aren't that question's reading.
    expect(
      (await readReply(fact("extent"), "The biopsy said adenocarcinoma.", adapter)).answer,
    ).toBe("unknown");
    expect(reader.measured(reader.current())).toBe(false);
  });
});
