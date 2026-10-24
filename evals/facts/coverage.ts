import type { FactLabelSet, FactLabels, UnmappedCategory } from "./labels.js";
import { UNMAPPED_CATEGORIES } from "./labels.js";

/**
 * What the vocabulary can express, from the labels alone (spec 0002 §6.2,
 * coverage and vocabulary gaps). No model is involved: this is the answer
 * to "are 25 to 40 facts enough?", asked before any mapping is run.
 */

export interface Coverage {
  trials: number;
  passages: number;
  byCategory: Record<"mapped" | UnmappedCategory, number>;
  /** Passages that are rules: everything but `not-a-rule`. */
  rules: number;
  /** mapped ÷ rules. */
  mappedShare: number;
  /** Rules about the person: mapped, gaps and trial-specific. Labs and procedures excluded. */
  personRules: number;
  /** mapped ÷ personRules. */
  mappedShareOfPersonRules: number;
  /** Mappings per fact, most used first. */
  factUse: { factId: string; mappings: number; trials: number }[];
  /** Vocabulary-gap notes, grouped by the note's text before any colon, most frequent first. */
  gaps: { gap: string; passages: number; trials: number; notes: string[] }[];
  /** Mappings scoped to part of a trial. */
  scoped: number;
}

export function coverageOf(labels: readonly FactLabels[], set?: FactLabelSet): Coverage {
  const chosen = set === undefined ? labels : labels.filter((l) => l.set === set);
  const byCategory = Object.fromEntries(
    ["mapped", ...UNMAPPED_CATEGORIES].map((c) => [c, 0]),
  ) as Coverage["byCategory"];
  const factUse = new Map<string, { mappings: number; trials: Set<string> }>();
  const gaps = new Map<string, { passages: number; trials: Set<string>; notes: Set<string> }>();
  let passages = 0;
  let scoped = 0;

  for (const trial of chosen) {
    for (const passage of trial.passages) {
      passages++;
      if (passage.mappings.length > 0) {
        byCategory.mapped++;
        for (const m of passage.mappings) {
          const use = factUse.get(m.factId) ?? { mappings: 0, trials: new Set<string>() };
          use.mappings++;
          use.trials.add(trial.nctId);
          factUse.set(m.factId, use);
          if (m.appliesTo !== null) scoped++;
        }
      } else if (passage.unmapped !== null) {
        byCategory[passage.unmapped]++;
        if (passage.unmapped === "vocabulary-gap") {
          const note = (passage.note ?? "").trim();
          const key = note.split(":")[0]?.trim() || note;
          const gap = gaps.get(key) ?? { passages: 0, trials: new Set<string>(), notes: new Set() };
          gap.passages++;
          gap.trials.add(trial.nctId);
          gap.notes.add(note);
          gaps.set(key, gap);
        }
      }
    }
  }

  const rules = passages - byCategory["not-a-rule"];
  const personRules =
    byCategory.mapped + byCategory["vocabulary-gap"] + byCategory["trial-specific"];
  return {
    trials: chosen.length,
    passages,
    byCategory,
    rules,
    mappedShare: share(byCategory.mapped, rules),
    personRules,
    mappedShareOfPersonRules: share(byCategory.mapped, personRules),
    factUse: [...factUse]
      .map(([factId, u]) => ({ factId, mappings: u.mappings, trials: u.trials.size }))
      .sort((a, b) => b.trials - a.trials || b.mappings - a.mappings || cmp(a.factId, b.factId)),
    gaps: [...gaps]
      .map(([gap, g]) => ({
        gap,
        passages: g.passages,
        trials: g.trials.size,
        notes: [...g.notes].sort(),
      }))
      .sort((a, b) => b.trials - a.trials || b.passages - a.passages || cmp(a.gap, b.gap)),
    scoped,
  };
}

function share(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 10_000) / 10_000;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
