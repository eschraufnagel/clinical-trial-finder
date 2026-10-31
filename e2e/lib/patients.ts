import { fileURLToPath } from "node:url";
import { loadPatient, type Patient, replyFor } from "../../evals/questions/patients.js";
import { fromReads, readReadsFile } from "../../evals/questions/reads.js";
import { loadContext, trialsFor } from "../../scripts/questions-eval.js";
import { runConversation } from "../../src/questions/conversation.js";

/**
 * A made-up patient for the browser test, and what the page should give them:
 * the short list `questions:try --reads` gives, from the local model's
 * committed readings of their replies, which is what `--fake` reads with.
 */
const DEV_READS = fileURLToPath(
  new URL(
    "../../evals/results/questions/reads/dev-qwen3.6-35b-a3b-mlx-8bit-8cb01749.json",
    import.meta.url,
  ),
);

const ctx = loadContext();

export function patient(id: string): Patient {
  return loadPatient(
    fileURLToPath(new URL(`../../evals/cases/patients/dev/${id}.json`, import.meta.url)),
    ctx.vocabulary,
    ctx.zips,
  );
}

/** What the patient types when asked a question, by the question's words. */
export function replyTo(p: Patient, question: string): string {
  const fact = ctx.vocabulary.facts.find((f) => f.question === question);
  if (fact === undefined) throw new Error(`not a question: ${question}`);
  return replyFor(p, fact.id, ctx.vocabulary);
}

/** The short list the page should end on, answered from the committed readings. */
export function expectedShortlist(p: Patient): string[] {
  const answer = fromReads(readReadsFile(DEV_READS));
  return runConversation({
    trials: trialsFor(p, ctx),
    vocabulary: ctx.vocabulary,
    settings: ctx.settings,
    cancerType: p.search.cancerType,
    sex: p.search.sex,
    answer: (factId) => answer(p, factId),
  }).shortlist.map((e) => e.candidate.nctId);
}
