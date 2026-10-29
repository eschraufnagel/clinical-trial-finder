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

  it("knows which models a committed held-out reading run measured", () => {
    expect(measuredModels()).toContain("Qwen3.6-35B-A3B-MLX-8bit");
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
