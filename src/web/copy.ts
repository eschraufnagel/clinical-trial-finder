/**
 * Every fixed sentence the page writes (spec 0004 §7). Components draw their
 * words from here or from the server's views, and `tests/web/copy.test.ts`
 * fails on any word written straight into a component, so one scan covers
 * them all.
 */
export const COPY = {
  title: "Trials to ask your oncologist about",
  brand: "Trial Finder",
  chip: {
    scripted: "Scripted reader · no model",
    local: (model: string) => `Local model · ${model}`,
    hosted: (provider: string, model: string) => `${provider} · ${model}`,
  },
  madeUp: "This is a proof of concept, run on this computer. Use made-up answers.",
  scripted: "Scripted reader: no model is called. Typed replies are read from a fixed list.",
  nav: {
    start: "Start",
    list: "Your list",
    sheet: "For your oncologist",
    check: "Your check",
    settings: "Settings",
  },

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
    next: {
      heading: "What happens next",
      steps: [
        "A few questions, one at a time.",
        "A short list of trials to ask your oncologist about.",
        "A sheet to print for your visit.",
      ],
    },
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
    question: (n: number) => `Question ${n}`,
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
    fromRecord: "From the record:",
    open: "Open",
    close: "Close",
    showRest: "Show them",
    hideRest: "Hide them",
    notStopped: "The questions aren't finished. This is the list so far.",
    tick: "Check this trial",
    tickNote:
      "Tick up to three trials to go through their own rules, one question at a time. Each gets a record for you and your oncologist.",
    tickLimit: "Three is the most one check takes.",
    checkThese: "Check these",
    checkFailed: "The check couldn't start. Nothing on your list changed. Try again.",
    starting: "Starting…",
  },

  check: {
    heading: "Checking the trials you picked",
    working: "Working…",
    stop: "Stop and show the records",
    back: "Back to your list",
    print: "Print or save as PDF",
    unmeasured: "On this model, the check hasn't been measured.",
    notChecked: "Not checked: the check stopped before this trial.",
    gone: "This check is no longer here. Checks are kept only while the page runs.",
  },

  record: {
    part: "For part of the trial:",
    askedEarlier: "Asked earlier:",
    youSaid: "You said:",
    rule: "The trial's rule:",
    show: "Show these rules",
    summary: "This record",
    about: {
      earlier: "Asked in the questions before the check.",
      told: "Answered here, rule by rule.",
      records: "Lab values, chart-only rules, and what you didn't know.",
      trial: "Rules about the trial's own procedures.",
      ask: 'Every "may not fit", and every rule that needs your records.',
    },
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
    columns: { question: "Question", said: "Said", answer: "Answer" },
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
    cap: "Most one conversation, or one trial checked, may spend on a hosted model, in dollars",
    saveCap: "Save",
    measurement: (readable: string, exact: string, invented: string) =>
      `Measured on made-up patients' replies: it could read ${readable} of them, and the rest would fall back to the answer buttons. Of the replies that stated an answer, it read ${exact} exactly; of the "I don't know"s, it turned ${invented} into an answer.`,
    unmeasured: "Its readings haven't been measured.",
    estimate: (usd: string) => `About ${usd} a conversation.`,
    price: (input: number, output: number) => `$${input} in, $${output} out, per million tokens.`,
    tested: (month: string) => `Tested against the live service ${month}.`,
    untested: "Not yet tested against the live service.",
    pricesAsOf: (month: string) => `Prices as of ${month}.`,
    saved: "Saved.",
  },
} as const;
