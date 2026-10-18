import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadZipPoints, milesBetween, pointForZip, UnknownZipError } from "../../src/search/geo.js";

/** Five rows in the committed table's format, with their real centroids. */
const FIXTURE = fileURLToPath(new URL("./fixtures/zips.csv", import.meta.url));

describe("loadZipPoints", () => {
  it("reads every row", () => {
    const points = loadZipPoints(FIXTURE);
    expect(points.size).toBe(5);
    expect(points.get("60611")).toEqual({ lat: 41.894742, lon: -87.615073 });
  });

  it("refuses a file without the header, and a malformed row, naming the line", () => {
    const dir = mkdtempSync(join(tmpdir(), "zips-"));
    const noHeader = join(dir, "a.csv");
    writeFileSync(noHeader, "60611,41.9,-87.6\n");
    expect(() => loadZipPoints(noHeader)).toThrow(/doesn't start with/);

    const badRow = join(dir, "b.csv");
    writeFileSync(badRow, "zip,lat,lon\n60611,41.9,-87.6\n6061,41.9,\n");
    expect(() => loadZipPoints(badRow)).toThrow(/line 3/);
  });
});

describe("pointForZip", () => {
  const points = loadZipPoints(FIXTURE);

  it("finds five digits, and ZIP+4 by its first five", () => {
    expect(pointForZip("62701", points)).toEqual({ lat: 39.800544, lon: -89.648894 });
    expect(pointForZip(" 62701-1234 ", points)).toEqual(pointForZip("62701", points));
  });

  it("says when a ZIP is malformed, and when it isn't in the table", () => {
    expect(() => pointForZip("6061", points)).toThrow(UnknownZipError);
    expect(() => pointForZip("6061", points)).toThrow(/five digits/);
    expect(() => pointForZip("00000", points)).toThrow(/Try a nearby ZIP/);
  });
});

describe("milesBetween", () => {
  const points = loadZipPoints(FIXTURE);
  const at = (zip: string) => pointForZip(zip, points);

  // Published great-circle distances between the cities' centres, which the
  // ZIP centroids sit close to.
  it("matches known distances to within a few miles", () => {
    expect(Math.abs(milesBetween(at("60611"), at("10001")) - 711)).toBeLessThan(5);
    expect(Math.abs(milesBetween(at("90012"), at("10001")) - 2445)).toBeLessThan(5);
  });

  it("is zero to itself and the same both ways", () => {
    expect(milesBetween(at("60611"), at("60611"))).toBe(0);
    expect(milesBetween(at("62701"), at("99501"))).toBeCloseTo(
      milesBetween(at("99501"), at("62701")),
      9,
    );
  });
});
