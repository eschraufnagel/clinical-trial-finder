/**
 * Public surface of the local server: the app's routes, and the one function
 * that listens (slice 0004).
 */
export { type AppOptions, configureApp, ownOrigins } from "./app.js";
export { LOOPBACK_HOST, type StartOptions, startServer } from "./start.js";
