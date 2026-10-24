/**
 * How many NSCLC candidate trials mention each topic in their eligibility
 * text (spec 0002 §2.2). An input to writing the fact vocabulary by hand.
 *
 *   npm run facts:topics
 *
 * Deterministic and writes nothing. A trial counts once per topic, however
 * often it mentions it. Matching is whole words on normalized text, as the
 * search's, so a count is a floor: a rule phrased in other words is missed.
 */
import { containsTerm, normalizeText } from "../src/search/normalize.js";
import { loadVocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import { candidateIds } from "./facts-candidates.js";

/** Each topic and the words that count as mentioning it. */
export const TOPICS: readonly (readonly [string, readonly string[]])[] = [
  // Disease
  ["histology: squamous", ["squamous"]],
  [
    "histology: small cell component or transformation",
    ["small cell transformation", "transformed to small cell", "mixed small cell"],
  ],
  [
    "extent: resectable or early stage",
    ["resectable", "stage i", "stage ii", "neoadjuvant", "adjuvant"],
  ],
  ["extent: locally advanced, unresectable", ["unresectable", "locally advanced", "stage iii"]],
  ["extent: metastatic or recurrent", ["metastatic", "stage iv", "recurrent"]],
  [
    "brain metastases",
    [
      "brain metastases",
      "brain metastasis",
      "cns metastases",
      "central nervous system metastases",
      "brain lesions",
    ],
  ],
  ["leptomeningeal disease", ["leptomeningeal"]],
  ["measurable disease", ["measurable disease", "measurable lesion", "recist"]],
  // Activity
  ["performance status", ["ecog", "performance status", "karnofsky"]],
  // Biomarkers
  ["EGFR", ["egfr"]],
  ["ALK", ["alk"]],
  ["ROS1", ["ros1"]],
  ["KRAS", ["kras"]],
  ["HER2", ["her2", "erbb2"]],
  ["MET", ["met exon 14", "met amplification", "c met", "met alteration"]],
  ["RET", ["ret fusion", "ret rearrangement", "ret alteration"]],
  ["BRAF", ["braf"]],
  ["NTRK", ["ntrk"]],
  ["PD-L1 level", ["pd l1 expression", "tumor proportion score", "tps"]],
  // Treatment so far
  [
    "PD-1 or PD-L1 inhibitor",
    ["pd 1", "pd l1 inhibitor", "checkpoint inhibitor", "immune checkpoint", "immunotherapy"],
  ],
  ["platinum chemotherapy", ["platinum"]],
  ["docetaxel", ["docetaxel"]],
  ["EGFR TKI", ["tyrosine kinase inhibitor", "tki", "osimertinib"]],
  ["antibody-drug conjugate", ["antibody drug conjugate", "adc", "topoisomerase"]],
  [
    "lines of therapy",
    ["prior lines", "lines of therapy", "line of therapy", "lines of systemic", "prior regimens"],
  ],
  ["radiation", ["radiotherapy", "radiation"]],
  // Other health
  [
    "another cancer",
    [
      "other malignancy",
      "prior malignancy",
      "another malignancy",
      "second primary",
      "additional malignancy",
      "concurrent malignancy",
    ],
  ],
  ["autoimmune disease", ["autoimmune"]],
  ["interstitial lung disease or pneumonitis", ["interstitial lung disease", "pneumonitis"]],
  ["HIV", ["hiv", "human immunodeficiency"]],
  ["hepatitis B or C", ["hepatitis b", "hepatitis c", "hbv", "hcv"]],
  [
    "heart attack, stroke, heart failure",
    ["myocardial infarction", "heart failure", "stroke", "cerebrovascular", "unstable angina"],
  ],
  ["organ transplant", ["transplant"]],
  ["pregnancy or breastfeeding", ["pregnant", "breastfeeding", "breast feeding", "lactating"]],
  ["corticosteroids", ["corticosteroid", "corticosteroids", "steroids"]],
  // Left out on purpose; counted for comparison
  ["labs: blood counts", ["neutrophil", "platelet", "hemoglobin"]],
  ["labs: kidney and liver", ["creatinine", "bilirubin", "ast", "alt"]],
  ["QTc", ["qtc"]],
];

export function countTopics(texts: readonly string[]): { topic: string; trials: number }[] {
  const normalized = texts.map(normalizeText);
  return TOPICS.map(([topic, terms]) => ({
    topic,
    trials: normalized.filter((text) => terms.some((term) => containsTerm(text, term))).length,
  }));
}

function main(): void {
  const { trials } = loadSnapshot();
  const ids = new Set(candidateIds(trials, loadVocabulary("nsclc")));
  const texts = trials.filter((t) => ids.has(t.nctId)).map((t) => t.eligibility.criteriaText);
  console.log(`${texts.length} NSCLC candidate trials; trials mentioning each topic:\n`);
  for (const { topic, trials: count } of countTopics(texts)) {
    const share = `${Math.round((count / texts.length) * 100)}%`;
    console.log(`  ${topic.padEnd(52)} ${String(count).padStart(5)}  ${share.padStart(4)}`);
  }
}

if (import.meta.main) {
  main();
}
