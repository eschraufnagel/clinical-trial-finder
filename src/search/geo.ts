import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * ZIP codes as points on a map, and distances between points (spec 0001 §3).
 *
 * The table is the Census Bureau's ZIP Code Tabulation Area gazetteer,
 * trimmed to `zip,lat,lon` and committed, so a ZIP becomes a point with no
 * network call. ZCTAs approximate ZIP codes: delivery-only ZIPs, such as a
 * single building's, have none.
 */

export interface Point {
  lat: number;
  lon: number;
}

export const DEFAULT_ZIP_FILE = fileURLToPath(
  new URL("../../data/geo/zcta-2025.csv", import.meta.url),
);

const HEADER = "zip,lat,lon";
const EARTH_RADIUS_MILES = 3958.8;

export class UnknownZipError extends Error {
  constructor(zip: string, reason: "malformed" | "absent") {
    super(
      reason === "malformed"
        ? `${JSON.stringify(zip)} isn't a US ZIP code. Give five digits, like 60611.`
        : `ZIP ${zip} isn't in the Census Bureau's ZIP table. Some ZIPs, such as a single building's, have no area of their own. Try a nearby ZIP.`,
    );
    this.name = "UnknownZipError";
  }
}

export function loadZipPoints(path: string = DEFAULT_ZIP_FILE): Map<string, Point> {
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines[0] !== HEADER) {
    throw new Error(`${path} doesn't start with "${HEADER}".`);
  }
  const points = new Map<string, Point>();
  lines.slice(1).forEach((line, i) => {
    if (line === "") return;
    const [zip, lat, lon] = line.split(",");
    const point = { lat: Number(lat), lon: Number(lon) };
    if (
      zip === undefined ||
      !/^\d{5}$/.test(zip) ||
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lon) ||
      lat === "" ||
      lon === ""
    ) {
      throw new Error(`${path} line ${i + 2} isn't "zip,lat,lon": ${JSON.stringify(line)}`);
    }
    points.set(zip, point);
  });
  return points;
}

/** Five digits, or ZIP+4, of which the first five are used. */
export function pointForZip(zip: string, points: ReadonlyMap<string, Point>): Point {
  const match = /^(\d{5})(?:-\d{4})?$/.exec(zip.trim());
  if (match?.[1] === undefined) {
    throw new UnknownZipError(zip, "malformed");
  }
  const point = points.get(match[1]);
  if (point === undefined) {
    throw new UnknownZipError(match[1], "absent");
  }
  return point;
}

/** Great-circle distance in miles (haversine). */
export function milesBetween(a: Point, b: Point): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}
