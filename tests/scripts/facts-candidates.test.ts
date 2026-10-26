import { describe, expect, it } from "vitest";
import { candidateIds } from "../../scripts/facts-candidates.js";
import { countTopics } from "../../scripts/facts-topics.js";
import { loadVocabulary } from "../../src/search/vocabulary.js";
import { rules, trial } from "../search/trial-fixture.js";

describe("candidateIds", () => {
  const vocabulary = loadVocabulary("nsclc");

  it("keeps treatment and no-purpose trials for the cancer, named ones first", () => {
    const ids = candidateIds(
      [
        trial("NCT00000004", { conditions: ["Solid Tumor"] }),
        trial("NCT00000003", { conditions: ["Non-Small Cell Lung Cancer"] }),
        trial("NCT00000002", { conditions: ["Solid Tumor"], primaryPurpose: null }),
        trial("NCT00000001", rules("Histologically confirmed NSCLC.")),
        trial("NCT00000005", { conditions: ["NSCLC"], primaryPurpose: "SUPPORTIVE_CARE" }),
        trial("NCT00000006"),
      ],
      vocabulary,
    );
    expect(ids).toEqual(["NCT00000001", "NCT00000003", "NCT00000002", "NCT00000004"]);
  });
});

describe("countTopics", () => {
  it("counts each trial once per topic, by whole words", () => {
    const counts = countTopics([
      "No active brain metastases. Brain metastases must be treated.",
      "ECOG 0-1; EGFR wild type.",
      "Patients with HER2-positive disease.",
    ]);
    const of = (topic: string) => counts.find((c) => c.topic === topic)?.trials;
    expect(of("brain metastases")).toBe(1);
    expect(of("performance status")).toBe(1);
    expect(of("EGFR")).toBe(1);
    expect(of("HER2")).toBe(1);
    expect(of("ALK")).toBe(0);
  });
});
