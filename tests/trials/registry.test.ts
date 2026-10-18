import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  fetchDataTimestamp,
  fetchSnapshotPage,
  fetchStudy,
  SNAPSHOT_QUERY,
  StudyNotFoundError,
} from "../../src/trials/registry.js";
import { TrialFixtureError } from "../../src/trials/types.js";

/**
 * `fetchStudy` with a fetch passed in, so nothing leaves the machine. The
 * response is the committed sample `trim.test.ts` reads.
 */

const sample = readFileSync(
  fileURLToPath(new URL("./fixtures/study-NCT00106626.json", import.meta.url)),
  "utf8",
);

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function answering(response: () => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response();
  };
  return { fetch: fake as typeof fetch, calls };
}

describe("fetchStudy", () => {
  it("asks ClinicalTrials.gov for the study by ID and trims what comes back", async () => {
    const { fetch, calls } = answering(() => new Response(sample, { status: 200 }));
    const trial = await fetchStudy("NCT00106626", fetch);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://clinicaltrials.gov/api/v2/studies/NCT00106626?format=json");
    expect(calls[0]?.init?.headers).toEqual({ accept: "application/json" });
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(trial.nctId).toBe("NCT00106626");
    expect(trial.eligibility.criteriaText.length).toBeGreaterThan(0);
    expect(JSON.stringify(trial)).not.toMatch(/contactsLocationsModule/);
  });

  it("says when the registry has no such study", async () => {
    const { fetch } = answering(() => new Response("{}", { status: 404 }));
    await expect(fetchStudy("NCT09999999", fetch)).rejects.toThrow(StudyNotFoundError);
    await expect(fetchStudy("NCT09999999", fetch)).rejects.toThrow(
      "ClinicalTrials.gov has no study NCT09999999.",
    );
  });

  it("says when the registry answers with another error", async () => {
    const { fetch } = answering(() => new Response("", { status: 503 }));
    await expect(fetchStudy("NCT00106626", fetch)).rejects.toThrow(
      "ClinicalTrials.gov answered HTTP 503.",
    );
  });

  it("says when the registry can't be reached", async () => {
    const fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof globalThis.fetch;
    await expect(fetchStudy("NCT00106626", fetch)).rejects.toThrow(
      "Couldn't reach ClinicalTrials.gov (fetch failed).",
    );
  });

  it("says when the body isn't JSON", async () => {
    const { fetch } = answering(() => new Response("<html>", { status: 200 }));
    await expect(fetchStudy("NCT00106626", fetch)).rejects.toThrow("isn't JSON");
  });

  it("names every field trimming can't read", async () => {
    const { fetch } = answering(() => new Response('{"protocolSection":{}}', { status: 200 }));
    await expect(fetchStudy("NCT00106626", fetch)).rejects.toThrow(TrialFixtureError);
  });

  it("refuses a malformed ID without fetching", async () => {
    const { fetch, calls } = answering(() => new Response(sample));
    await expect(fetchStudy("NCT1/../../x", fetch)).rejects.toThrow("Not an NCT ID");
    expect(calls).toHaveLength(0);
  });
});

describe("fetchSnapshotPage", () => {
  const page = JSON.stringify({ studies: [{ a: 1 }, { b: 2 }], nextPageToken: "abc&def=1" });

  it("asks for the fixed snapshot query, and returns the studies and the next token", async () => {
    const { fetch, calls } = answering(() => new Response(page, { status: 200 }));
    const result = await fetchSnapshotPage(null, fetch);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`https://clinicaltrials.gov/api/v2/studies?${SNAPSHOT_QUERY}`);
    expect(calls[0]?.init?.headers).toEqual({ accept: "application/json" });
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ studies: [{ a: 1 }, { b: 2 }], nextPageToken: "abc&def=1" });
  });

  it("asks for recruiting interventional cancer studies with a US site", () => {
    const decoded = decodeURIComponent(SNAPSHOT_QUERY);
    expect(decoded).toContain("query.cond=cancer");
    expect(decoded).toContain("filter.overallStatus=RECRUITING");
    expect(decoded).toContain(
      'AREA[StudyType]INTERVENTIONAL AND AREA[LocationCountry]"United States"',
    );
    expect(decoded).toContain("pageSize=1000");
  });

  // The token is the registry's, but it's still encoded, so it can only ever
  // be a page token: never a second parameter, never another path.
  it("encodes the page token it's given", async () => {
    const { fetch, calls } = answering(() => new Response(page, { status: 200 }));
    await fetchSnapshotPage("abc&def=1/../x", fetch);

    expect(calls[0]?.url).toBe(
      `https://clinicaltrials.gov/api/v2/studies?${SNAPSHOT_QUERY}&pageToken=abc%26def%3D1%2F..%2Fx`,
    );
  });

  it("says when there's no next page", async () => {
    const { fetch } = answering(() => new Response('{"studies":[]}', { status: 200 }));
    expect((await fetchSnapshotPage("t", fetch)).nextPageToken).toBeNull();
  });

  it("refuses a page with no studies list, and words errors as fetchStudy does", async () => {
    await expect(
      fetchSnapshotPage(null, answering(() => new Response("{}", { status: 200 })).fetch),
    ).rejects.toThrow("no studies list");
    await expect(
      fetchSnapshotPage(null, answering(() => new Response("", { status: 503 })).fetch),
    ).rejects.toThrow("ClinicalTrials.gov answered HTTP 503.");
    const unreachable = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof globalThis.fetch;
    await expect(fetchSnapshotPage(null, unreachable)).rejects.toThrow(
      "Couldn't reach ClinicalTrials.gov (fetch failed).",
    );
  });
});

describe("fetchDataTimestamp", () => {
  it("asks for the registry's version and returns its data timestamp", async () => {
    const { fetch, calls } = answering(
      () => new Response('{"apiVersion":"2.0.5","dataTimestamp":"2000-01-20T09:00:05"}'),
    );
    expect(await fetchDataTimestamp(fetch)).toBe("2000-01-20T09:00:05");
    expect(calls[0]?.url).toBe("https://clinicaltrials.gov/api/v2/version");
  });

  it("refuses a version with no timestamp", async () => {
    const { fetch } = answering(() => new Response('{"apiVersion":"2.0.5"}'));
    await expect(fetchDataTimestamp(fetch)).rejects.toThrow("no dataTimestamp");
  });
});
