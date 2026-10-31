/**
 * Public surface of the local server: the app's routes, and the one function
 * that listens (slice 0004).
 */
export { type App, type AppOptions, configureApp, ownOrigins } from "./app.js";
export {
  CHECK_WORDS,
  type CheckOptions,
  CheckService,
  type CheckStart,
  type CheckView,
  MAX_CHECKED,
  READING_WORDS,
  TAPS,
} from "./check.js";
export {
  type AnswerView,
  type CheckSource,
  CONFIRM,
  checkForm,
  type FinderOptions,
  FinderService,
  type FinderView,
  type ReaderSource,
  type SearchForm,
  type StartOutcome,
  WORDS,
} from "./finder.js";
export { LOOPBACK_HOST, type StartOptions, startServer } from "./start.js";
