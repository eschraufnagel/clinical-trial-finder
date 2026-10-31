import { parseCriteria } from "../../src/criteria/parse.js";
import type { ParseableTrial } from "../../src/criteria/prompt.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { FakeModelAdapter, ModelError, type ScriptedResponse } from "../../src/models/index.js";
import type { TrialInput } from "../../src/questions/select.js";
import { UnknownZipError } from "../../src/search/geo.js";
import type { CheckOptions } from "../../src/server/check.js";
import type { FinderOptions, ReaderSource } from "../../src/server/finder.js";
import { getTrial } from "../../src/trials/index.js";
import { SETTINGS, trials, vocabulary } from "../questions/fixture.js";

/**
 * The server's tests run on the chooser's fixture (tests/questions/fixture.ts):
 * eight made-up trials, an intake of brain metastases, a short list of 3.
 * The reader is scripted: each reply's reading is looked up by its exact
 * text, and anything else is unknown. No model is reached.
 */

export const NO_SUCH_ZIP = "00000";

export interface ScriptedReader extends ReaderSource {
  released: number;
}

export function scriptedReader(
  readings: Record<string, ScriptedResponse> = {},
  options: { unbuildable?: string } = {},
): ScriptedReader {
  const reader: ScriptedReader = {
    released: 0,
    current: () => "scripted",
    name: () => "a scripted reader",
    measured: () => false,
    forConversation: () => {
      if (options.unbuildable !== undefined)
        throw new ModelError("Cannot use the model", [options.unbuildable]);
      return new FakeModelAdapter([], {
        respond: (request) => {
          const reply = /Reply: (".*")$/m.exec(request.user)?.[1];
          const text = reply === undefined ? "" : (JSON.parse(reply) as string);
          return readings[text] ?? { kind: "json", content: { answer: "unknown" } };
        },
      });
    },
    release: () => {
      reader.released++;
    },
  };
  return reader;
}

export function finderOptions(
  reader: ReaderSource = scriptedReader(),
  input: TrialInput[] = trials(),
): Omit<FinderOptions, "transport"> {
  return {
    reader,
    trialsFor: (search) => {
      if (search.zip === NO_SUCH_ZIP) throw new UnknownZipError(search.zip, "absent");
      return input;
    },
    vocabulary,
    settings: SETTINGS,
    snapshotMonth: "2000-01",
    newId: (() => {
      let n = 0;
      return () => `c${++n}`;
    })(),
  };
}

export const FORM = { zip: "60611", radiusMiles: 50, age: 60, sex: "female" } as const;

/** Lets the scripted reader's promise settle and the service act on it. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

/*
 * The check's data (slice 0007). Each made-up trial on the conversation's
 * list borrows a real pinned protocol's text, so the parse's and the
 * mappings' quotes locate. The parse is the fake adapter's: two rules, ECOG
 * and contraception. The conversation's first question, brain metastases, is
 * mapped onto the ECOG rule, so answering it carries that rule.
 */

const PROTOCOL = getTrial("NCT04316364");
const TEXT = PROTOCOL.eligibility.criteriaText;
export const ECOG = "Eastern Cooperative Oncology Group (ECOG) performance status 0 or 1";
export const CONTRACEPTION =
  "Women of childbearing age without sterilizing or male, must agree to use contraception";

const trialAs = (nctId: string): ParseableTrial => ({
  ...PROTOCOL,
  nctId,
  briefTitle: `Trial ${nctId}`,
});

export const parser = () =>
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

const span = (quote: string) => {
  const start = TEXT.indexOf(quote);
  return { start, end: start + quote.length, text: quote };
};

const mapping: FactMapping = {
  factId: "brain_mets",
  rulesOut: ["symptoms"],
  polarity: "exclusion",
  source: span(ECOG),
};

const facts = (nctId: string): TrialFacts => ({
  nctId,
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
});

/** The check's options besides its transport, reader and conversation: questions in the trial's words. */
export function checkOptions(): Omit<CheckOptions, "transport" | "reader" | "finder"> {
  return {
    trial: (id) => (/^NCT0[1-8]$/.test(id) ? trialAs(id) : undefined),
    facts,
    parse: (trial) => parseCriteria(trial, parser()),
    fixedQuestions: true,
  };
}
