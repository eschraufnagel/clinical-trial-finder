import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { toZipCsv, unzipSingle } from "../../scripts/fetch-zips.js";

/** A zip archive with one deflated entry, built by hand: local header, data, central header. */
function zipOf(content: string, flags = 0, method = 8, extraEntry = false): Buffer {
  const name = Buffer.from("a.txt");
  const data = Buffer.from(content, "utf8");
  const packed = method === 8 ? deflateRawSync(data) : data;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const next = Buffer.alloc(4);
  next.writeUInt32LE(extraEntry ? 0x04034b50 : 0x02014b50, 0);
  return Buffer.concat([local, name, packed, next]);
}

describe("unzipSingle", () => {
  it("inflates the one entry", () => {
    expect(unzipSingle(zipOf("GEOID|INTPTLAT\n")).toString("utf8")).toBe("GEOID|INTPTLAT\n");
  });

  it("refuses what it can't read safely", () => {
    expect(() => unzipSingle(Buffer.from("not a zip at all, clearly not one"))).toThrow(
      /Not a zip/,
    );
    expect(() => unzipSingle(zipOf("x", 0x08))).toThrow(/data descriptor/);
    expect(() => unzipSingle(zipOf("x", 0, 0))).toThrow(/not deflate/);
    expect(() => unzipSingle(zipOf("x", 0, 8, true))).toThrow(/more than one entry/);
  });
});

describe("toZipCsv", () => {
  const gazetteer = [
    "GEOID|GEOIDFQ|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG",
    "62701|860Z200US62701|1|0|0|0|39.800458|-89.649426",
    "10001|860Z200US10001|1|0|0|0|40.750633|-73.997177",
    "",
  ].join("\n");

  it("keeps ZIP, latitude and longitude, sorted, by column name", () => {
    expect(toZipCsv(gazetteer)).toBe(
      "zip,lat,lon\n10001,40.750633,-73.997177\n62701,39.800458,-89.649426\n",
    );
  });

  it("reads the tab-separated form too", () => {
    expect(toZipCsv("GEOID\tINTPTLAT\tINTPTLONG   \n62701\t39.8\t-89.6\n")).toBe(
      "zip,lat,lon\n62701,39.8,-89.6\n",
    );
  });

  it("refuses a missing column or an unreadable row", () => {
    expect(() => toZipCsv("GEOID|INTPTLAT\n62701|39.8\n")).toThrow(/no INTPTLONG/);
    expect(() => toZipCsv("GEOID|INTPTLAT|INTPTLONG\n627|39.8|-89.6\n")).toThrow(/line 2/);
  });
});
