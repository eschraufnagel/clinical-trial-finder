import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FactVocabulary } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import {
  ConversationSettingsError,
  loadConversationSettings,
} from "../../src/questions/settings.js";

const vocabulary = loadFactVocabulary();

function fileWith(value: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "settings-")), "conversation.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe("loadConversationSettings", () => {
  it("loads the committed file, with its hash", () => {
    const settings = loadConversationSettings(vocabulary);
    expect(settings.intake[0]).toBe("histology");
    expect(settings.scorer).toBe("shortlist");
    expect(settings.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads an order, and takes a file with none as 0003's", () => {
    const base = {
      version: 1,
      intake: ["ecog"],
      skip: [],
      shortlistSize: 10,
      budget: 8,
      scorer: "shortlist",
    };
    expect(loadConversationSettings(vocabulary, fileWith(base)).order).toBe("hints");
    expect(
      loadConversationSettings(vocabulary, fileWith({ ...base, order: "checked" })).order,
    ).toBe("checked");
  });

  it("rejects every rule, and names them all", () => {
    // A fact for another cancer only: the vocabulary has none, so add one.
    const withOther: FactVocabulary = {
      ...vocabulary,
      facts: [
        ...vocabulary.facts,
        {
          id: "gleason",
          question: "?",
          answers: [
            { id: "a", words: "a" },
            { id: "b", words: "b" },
          ],
          whoKnows: "records",
          cancerTypes: ["prostate"],
        },
      ],
    };
    const path = fileWith({
      version: 2,
      intake: ["ecog", "ecog", "nope", "gleason"],
      skip: [{ factId: "nope", sex: "other" }],
      shortlistSize: 0,
      budget: 1.5,
      scorer: "random",
      order: "best",
    });
    let message = "";
    try {
      loadConversationSettings(withOther, path);
    } catch (e) {
      expect(e).toBeInstanceOf(ConversationSettingsError);
      message = (e as Error).message;
    }
    for (const expected of [
      "version is not 1",
      "intake lists ecog twice",
      "intake: nope isn't a fact",
      "intake: gleason isn't a fact for nsclc",
      "skip: nope isn't a fact",
      "skip: sex other is not female or male",
      "shortlistSize is not a whole number of at least 1",
      "budget is not a whole number of at least 1",
      "scorer random is not one of fixed, count, shortlist",
      "order best is not one of hints, checked, read-first",
    ]) {
      expect(message).toContain(expected);
    }
  });
});
