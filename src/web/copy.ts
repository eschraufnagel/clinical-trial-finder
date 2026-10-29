/**
 * Every fixed sentence the page writes (spec 0004 §7). Components draw their
 * words from here or from the server's views, so one scan covers them all
 * (`tests/web/copy.test.ts`).
 */
export const COPY = {
  title: "Trials to ask your oncologist about",
  madeUp: "This is a proof of concept. Use made-up answers.",
} as const;
