import { FakeModelAdapter, ModelError, type ScriptedResponse } from "../../src/models/index.js";
import type { TrialInput } from "../../src/questions/select.js";
import { UnknownZipError } from "../../src/search/geo.js";
import type { FinderOptions, ReaderSource } from "../../src/server/finder.js";
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
