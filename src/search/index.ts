/**
 * Public surface of the search module (slice 0001): no model, no network,
 * no clock. `tests/boundary.test.ts` walks the graph reachable from here.
 */
export {
  DEFAULT_ZIP_FILE,
  loadZipPoints,
  milesBetween,
  type Point,
  pointForZip,
  UnknownZipError,
} from "./geo.js";
