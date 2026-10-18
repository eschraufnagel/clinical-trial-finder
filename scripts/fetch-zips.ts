/**
 * Fetches the Census Bureau's 2025 ZIP Code Tabulation Area gazetteer and
 * writes `data/geo/zcta-2025.csv` (spec 0001 §3): one `zip,lat,lon` row per
 * ZCTA, sorted. Public domain.
 *
 *   npm run geo:fetch
 *
 * Run by a person, deliberately. Lives under `scripts/`, outside the
 * application tree, so `src/` gains no network host. The download is a zip
 * with one entry, unpacked with Node's own zlib.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inflateRawSync } from "node:zlib";
import { DEFAULT_ZIP_FILE } from "../src/search/geo.js";

const SOURCE =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const DEFLATE = 8;

/**
 * The one file in a zip archive. Refuses anything else: a second entry, a
 * method other than deflate, or sizes deferred to a data descriptor, which
 * this reader doesn't follow.
 */
export function unzipSingle(zip: Buffer): Buffer {
  if (zip.length < 30 || zip.readUInt32LE(0) !== LOCAL_HEADER) {
    throw new Error("Not a zip archive: no local file header.");
  }
  const flags = zip.readUInt16LE(6);
  const method = zip.readUInt16LE(8);
  const compressedSize = zip.readUInt32LE(18);
  const size = zip.readUInt32LE(22);
  const start = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
  if ((flags & 0x08) !== 0) {
    throw new Error("The zip's sizes are in a data descriptor, which this reader doesn't follow.");
  }
  if (method !== DEFLATE) {
    throw new Error(`The zip's entry uses method ${method}, not deflate.`);
  }
  const end = start + compressedSize;
  if (end + 4 > zip.length || zip.readUInt32LE(end) !== CENTRAL_HEADER) {
    throw new Error("The zip has more than one entry, or is truncated.");
  }
  const out = inflateRawSync(zip.subarray(start, end));
  if (out.length !== size) {
    throw new Error(`The zip's entry inflated to ${out.length} bytes, not ${size}.`);
  }
  return out;
}

/**
 * The gazetteer's pipe- or tab-separated text as `zip,lat,lon`, sorted by ZIP,
 * header first. Columns are found by name, so their order can change.
 */
export function toZipCsv(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0];
  if (header === undefined) {
    throw new Error("The gazetteer is empty.");
  }
  const separator = header.includes("|") ? "|" : "\t";
  const columns = header.split(separator).map((c) => c.trim());
  const at = (name: string) => {
    const i = columns.indexOf(name);
    if (i < 0) throw new Error(`The gazetteer has no ${name} column.`);
    return i;
  };
  const [zipAt, latAt, lonAt] = [at("GEOID"), at("INTPTLAT"), at("INTPTLONG")];
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(separator).map((c) => c.trim());
    const [zip, lat, lon] = [cells[zipAt], cells[latAt], cells[lonAt]];
    if (zip === undefined || !/^\d{5}$/.test(zip) || !isNumber(lat) || !isNumber(lon)) {
      throw new Error(`Gazetteer line ${i + 2} isn't readable: ${JSON.stringify(line)}`);
    }
    return `${zip},${lat},${lon}`;
  });
  rows.sort();
  return `zip,lat,lon\n${rows.join("\n")}\n`;
}

function isNumber(value: string | undefined): value is string {
  return value !== undefined && value !== "" && Number.isFinite(Number(value));
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`The Census Bureau answered HTTP ${response.status}.`);
  }
  const csv = toZipCsv(unzipSingle(Buffer.from(await response.arrayBuffer())).toString("utf8"));
  mkdirSync(dirname(DEFAULT_ZIP_FILE), { recursive: true });
  writeFileSync(DEFAULT_ZIP_FILE, csv, "utf8");
  console.log(`Wrote ${csv.split("\n").length - 2} ZIPs to ${DEFAULT_ZIP_FILE}`);
}

if (import.meta.main) {
  await main();
}
