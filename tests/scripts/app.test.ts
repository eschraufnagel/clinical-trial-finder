import { describe, expect, it } from "vitest";
import { measuredModels, parseAppArgs, scriptedReader } from "../../scripts/app.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { readReply } from "../../src/questions/read.js";

const vocabulary = loadFactVocabulary();
const fact = (id: string) => {
  const f = vocabulary.facts.find((x) => x.id === id);
  if (f === undefined) throw new Error(id);
  return f;
};

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
    // Claude Haiku 4.5 could read 237 of 527: 217 of 217 exactly, 0 of 20 invented.
    expect(byModel.get("claude-haiku-4-5")).toEqual({
      model: "claude-haiku-4-5",
      readable: 237 / 527,
      exact: 1,
      invented: 0,
    });
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
