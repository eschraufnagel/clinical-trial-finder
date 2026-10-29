/**
 * Every fixed sentence the page writes (spec 0004 §7). Components draw their
 * words from here or from the server's views, and `tests/web/copy.test.ts`
 * fails on any word written straight into a component, so one scan covers
 * them all.
 */
export const COPY = {
  title: "Trials to ask your oncologist about",
  madeUp: "This is a proof of concept, run on this computer. Use made-up answers.",
  scripted: "Scripted reader: no model is called. Typed replies are read from a fixed list.",
  nav: { start: "Start", list: "Your list", sheet: "For your oncologist", settings: "Settings" },

  search: {
    heading: "Where to look",
    intro:
      "Lung cancer (non-small cell) only, for now. Other cancers aren't ready: the questions and trial readings cover lung cancer alone.",
    zip: "ZIP code",
    distance: "How far you could travel",
    anywhere: "Anywhere in the US",
    miles: (n: number) => `${n} miles`,
    age: "Age",
    sex: "Sex, as the trials ask it",
    female: "Female",
    male: "Male",
    start: "Start the questions",
    starting: "Searching the trials…",
  },

  conversation: {
    reply: "Your answer, in your own words",
    send: "Send",
    choose: "Not sure how to say it? Choose an answer",
    working: "Reading your answer…",
    listNow: "Show me the list now",
    seeList: "See your list",
    startOver: "Start over",
    readBy: (model: string) => `Read by ${model}.`,
    unmeasured: "This model's readings haven't been measured.",
    hosted: (name: string) =>
      `While ${name} is chosen in Settings, what you type here is sent to ${name}. Use made-up answers.`,
    local: "Your answers stay on this computer. Use made-up answers.",
    failed: "Something went wrong. Try again.",
    tryAgain: "Try again",
  },

  list: {
    phase: "Phase",
    site: "Where",
    read: "How much was read",
    checked: "What your answers checked",
    hints: "May not fit",
    yourAnswer: "Your answer:",
    theRule: "The trial's rule:",
    part: "For part of the trial:",
    youSaid: "You said:",
    unknown: "Still unknown",
    flags: "About the record",
    interventions: "What it tests",
    open: "Open",
    close: "Close",
    showRest: "Show them",
    hideRest: "Hide them",
    notStopped: "The questions aren't finished. This is the list so far.",
  },

  answers: {
    heading: "Your answers",
    change: "Change",
    cancel: "Cancel",
    save: "Save",
    chose: "Chose from a list",
    notKnown: "Not known yet",
    note: "Changing an answer reorders the list. No more questions are asked.",
  },

  sheet: {
    print: "Print or save as PDF",
    youSaid: "Said:",
    answer: "Answer:",
  },

  settings: {
    heading: "Settings",
    intro:
      "Which model reads your answers. The local model runs on this computer and nothing leaves it. A hosted model sends what you type to its provider, with your own key.",
    scripted: "In scripted mode nothing is called; these choices are saved but not used.",
    local: "The local model",
    baseUrl: "Address",
    model: "Model",
    keyLocal: "Key for the local model",
    key: "Key",
    saveKey: "Save key",
    removeKey: "Remove key",
    keySaved: (hint: string) => `Key saved (${hint}).`,
    noKey: "No key saved.",
    keyFromEnv: "Using the key from .env.",
    test: "Test",
    testing: "Testing…",
    works: (model: string, read: string) => `It works: ${model} read "${read}" correctly.`,
    use: "Use this model",
    inUse: "In use",
    cap: "Most one conversation may spend on a hosted model, in dollars",
    saveCap: "Save",
    measured: "Its readings were measured.",
    unmeasured: "Its readings haven't been measured.",
    estimate: (usd: string) => `About ${usd} a conversation.`,
    price: (input: number, output: number) => `$${input} in, $${output} out, per million tokens.`,
    tested: (month: string) => `Tested against the live service ${month}.`,
    untested: "Not yet tested against the live service.",
    pricesAsOf: (month: string) => `Prices as of ${month}.`,
    saved: "Saved.",
  },
} as const;
