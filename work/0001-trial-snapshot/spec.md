# spec: 0001 trial snapshot and search

**Status:** Draft, from `intent.md`
**Date:** 2026-10

What the slice builds, the shapes it adds, and what proves it. The order of work is in `plan.md`.

---

## 1. What a person sees

Three commands, all run by a person in a terminal:

```
npm run snapshot:fetch                 fetch the snapshot from ClinicalTrials.gov and write it
npm run snapshot:fetch -- --dry-run    report what changed since the committed snapshot, write nothing
npm run search -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female
```

`search` prints a funnel, then one line per kept trial:

```
Snapshot 2026-10: 5,740 trials (registry data of 2026-10-16)
  treatment trials                 4,241
  for non-small cell lung cancer   1,180   (names it 610 · mentions it in its rules 21 · open to many 549)
  open to a 64-year-old female     1,166
  recruiting within 50 miles         173

NCT0xxxxxxx  Phase 2  names it            3 mi  Northwestern Memorial Hospital, Chicago IL
NCT0xxxxxxx  Phase 1  open to many        3 mi  ...                                         record not updated in 14 months
...
```

The numbers above are illustrative. `--miles anywhere` drops the distance filter, `--purpose all` keeps non-treatment trials, and `--json` prints the result object (§5). An unknown ZIP or cancer type is an error naming the problem, never an empty list.

## 2. The snapshot

### 2.1 Query

One paged search of ClinicalTrials.gov API v2 `/studies`:

- `query.cond=cancer` (the registry's own condition search, which expands synonyms: `cancer` and `neoplasm` return the same set)
- `filter.overallStatus=RECRUITING`
- `filter.advanced=AREA[StudyType]INTERVENTIONAL AND AREA[LocationCountry]"United States"`
- `pageSize=1000`, following `nextPageToken`, with full records rather than `fields=`, so trimming stays in one tested place, as `fetchStudy` does

Plus one request to `/version` for `dataTimestamp`. About seven requests and 117 MB in total, measured while writing the intent.

### 2.2 What's kept (`src/trials/snapshot-types.ts`)

```ts
interface SnapshotTrial {
  nctId: string;
  briefTitle: string;
  officialTitle: string | null;
  overallStatus: string;
  phases: string[];
  primaryPurpose: string | null;     // designModule.designInfo.primaryPurpose
  conditions: string[];
  keywords: string[];
  conditionMesh: string[];           // derivedSection.conditionBrowseModule.meshes[].term
  conditionAncestors: string[];      // ...ancestors[].term
  interventions: { type: string | null; name: string }[];
  leadSponsor: string;
  lastUpdatePostDate: string;        // as the registry gives it
  completionDate: string | null;     // statusModule.completionDateStruct.date, as given
  eligibility: TrialEligibility;     // the existing shape from src/trials/types.ts, text verbatim
  sites: Site[];                     // US locations only
}

interface Site {
  facility: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;             // the site's own recruitment status
  lat: number | null;
  lon: number | null;
}
```

Location contacts, central contacts, overall officials, outcomes, arms and everything else are dropped. Contacts name real people, and nothing here uses them. Interventions and the completion date are kept for 0003 and 0004, which will show what a trial tests and flag stale records.

`trimSnapshotStudy(raw, source)` in `src/trials/snapshot-trim.ts` follows `trimStudy`'s rules. It's pure. Each field is read from one path. Required fields (`nctId`, `briefTitle`, `overallStatus`, `leadSponsor`, `lastUpdatePostDate`, the eligibility fields `trimStudy` already requires) collect every problem before throwing `TrialFixtureError`. Optional ones become `null` or `[]`.

### 2.3 Files

```
data/snapshot/2026-10/
  trials.jsonl.gz    one SnapshotTrial per line, in NCT ID order, keys in declaration order, gzip level 9
  manifest.json      readable: what this is and how to check it
```

```ts
interface SnapshotManifest {
  version: 1;
  month: string;                 // "2026-10": dataTimestamp.slice(0, 7), not the clock (amended in plan)
  dataTimestamp: string;         // the registry's /version, as given
  query: string;                 // the exact query string requested
  count: number;
  sha256: string;                // of trials.jsonl.gz
  fields: string[];              // SnapshotTrial's keys, so a reader knows the shape without code
}
```

The same input gives a byte-identical file: sorted lines, fixed key order, and Node's gzip header (mtime 0). A refetch that changes nothing produces no diff. `--dry-run` compares by NCT ID and reports added, removed and changed counts, with up to 20 IDs each.

**If the snapshot gate decides not to commit:** the same two files go to a gitignored `snapshot/` folder at the repository root, the measurement result records the checksum, and docs say a result can only be checked by refetching. Nothing else in this spec changes.

### 2.4 Fetching and loading

- `fetchSnapshotPage(query, pageToken, fetch)` in `src/trials/registry.ts`, beside `fetchStudy`, with the same timeout, error messages and injected `fetch`. It builds its URL from fixed parameters plus the page token. No caller-supplied URL.
- `scripts/fetch-snapshot.ts` pages until done, waits 1.5 s between requests, trims each study, sorts, writes both files, and prints the count and checksum. Run by a person, deliberately.
- `loadSnapshot(dir)` in `src/trials/snapshot-load.ts` reads the manifest, checks the checksum, gunzips and parses each line, validates its shape (`validateSnapshotTrial`, hand-written like `validateTrial`), and checks that the count matches and the NCT IDs are sorted and unique. Every fault throws `TrialFixtureError` naming the file and line. Synchronous. About a second for the full snapshot, so tests never call it on the real one.

## 3. ZIP code locations

- Source: the Census Bureau's 2025 Gazetteer ZCTA file (`2025_Gaz_zcta_national.zip`, about 1 MB, public domain), fetched by `scripts/fetch-zips.ts`. The script unpacks its single entry with `zlib.inflateRawSync`, after checking the zip's local file header. No dependency.
- Committed as `data/geo/zcta-2025.csv`: `zip,lat,lon`, one row per ZCTA (about 33,800), sorted, header line first.
- `loadZipPoints(path)` returns a `Map<string, {lat, lon}>`. `pointForZip(zip, points)` accepts five digits, or ZIP+4 (only the first five are used), and throws `UnknownZipError` for anything else or a ZIP that isn't in the table. The message says ZCTAs don't cover every delivery-only ZIP, and to try a nearby one.

## 4. The cancer-type vocabulary

`data/cancer-types/` holds one JSON file per type plus a shared generic list:

```ts
interface CancerType {
  id: string;                 // "nsclc"
  label: string;              // "non-small cell lung cancer"
  measured: boolean;          // true only once a committed result covers it
  names: string[];            // terms that name it: "non small cell lung", "nsclc", "lung adenocarcinoma", ...
  meshHeadings: string[];     // "Carcinoma, Non-Small-Cell Lung", "Lung Neoplasms", ...
  biomarkerNames: string[];   // conditions that are a biomarker typical of it: "egfr", "alk", "ros1", "kras g12c", "met exon 14", ...
}

interface GenericTerms {      // data/cancer-types/generic.json
  terms: string[];            // "solid tumor", "solid tumors", "solid malignancies", "advanced cancer", "neoplasms", ...
}
```

**Matching** is on normalized text: lowercased, every run of characters that isn't a letter or digit replaced by one space, padded with a space each side. A term matches when its own normalized form, padded the same way, occurs in the field. "Non-Small-Cell" and "non small cell" are the same; "nsclc" doesn't match inside "nsclcx". `loadVocabulary` rejects a term that normalizes to empty, and a duplicate within a file.

A trial is **for the cancer type** for one or more of these reasons, all recorded:

| Reason | Shown as | Rule |
| --- | --- | --- |
| `names` | names it | a `names` term in a condition, keyword or the brief or official title; a `meshHeadings` entry equal to one of `conditionMesh`; or a `biomarkerNames` term in a condition or keyword |
| `rules` | mentions it in its rules | a `names` term anywhere in the eligibility text |
| `generic` | open to many | a generic term equal to a whole normalized condition, or contained in one |

`rules` is deliberately broad: it also matches "no history of non-small cell lung cancer". Recall comes first, and the measurement reports how much precision each reason costs (§6.4). The vocabulary's first version is written from the measured examples in the intent. It's improved only against the dev pool (§6.2).

## 5. The search (`src/search/`)

```ts
interface SearchRequest {
  cancerType: string;               // an id in data/cancer-types/
  age: number;                      // whole years
  sex: "female" | "male";
  zip: string;
  radiusMiles: number | null;       // null: anywhere in the US
  purposes: string[] | "all";       // default ["TREATMENT"]
}

interface SearchResult {
  snapshot: { month: string; dataTimestamp: string };
  funnel: { stage: FunnelStage; count: number }[];  // snapshot, purpose, cancer, age-and-sex, distance
  candidates: Candidate[];
}

interface Candidate {
  nctId: string;
  briefTitle: string;
  phases: string[];
  reasons: ("names" | "rules" | "generic")[];
  nearestSite: { facility: string | null; city: string | null; state: string | null; miles: number | null } | null;
  flags: ("stale-record" | "past-completion" | "age-limit-unread" | "site-distance-unknown")[];
}
```

`searchTrials(trials, manifest, vocabulary, zipPoints, request)` is pure. It reads no file and no clock.

1. **Purpose.** Keep trials whose `primaryPurpose` is in `purposes`. A trial with `null` purpose is kept when `purposes` includes `TREATMENT`, because recall comes first.
2. **Cancer type.** Keep trials with at least one reason (§4).
3. **Age and sex.** `minimumAge` and `maximumAge` are read as `<number> <Years|Months|Weeks|Days>` (singular or plural) into years. A missing limit is no limit. A limit that doesn't read keeps the trial and adds `age-limit-unread`. Sex `ALL` or missing keeps the trial; `FEMALE` or `MALE` keeps it only for that sex.
4. **Distance.** The sites that count are US sites whose status is `RECRUITING`, or missing. The distance is great-circle (haversine, Earth radius 3,958.8 miles) from the ZIP's point to each counted site, rounded to whole miles. With a radius, keep trials with a counted site within it. A counted site with no coordinates keeps the trial with `site-distance-unknown`, and `nearestSite.miles` is `null` unless another site is closer. A trial with no counted site is dropped at this stage, and the funnel shows it.
5. **Flags.** `stale-record` when `lastUpdatePostDate` is more than 12 months before the manifest's `dataTimestamp`. `past-completion` when `completionDate` is before it (a month-only date counts as the month's last day). Flags never drop a trial.
6. **Order.** By nearest distance (unknown last), then NCT ID. That's for reading the list, not a ranking. Ranking is 0004's.

`src/search/` imports `src/trials/` types only. It imports nothing from `src/models/`, `src/criteria/` or `src/screening/`, and `tests/boundary.test.ts` checks that.

## 6. Measuring what the search drops

### 6.1 What a label says

`evals/cases/search/ANNOTATION.md` defines it. **Relevant:** the trial would consider an adult with NSCLC, at some stage, for at least one arm or cohort. That includes trials open to "any solid tumor" unless they exclude lung cancer or NSCLC, and NSCLC cohorts inside trials named for something else. It excludes trials limited to other cancers, to small cell lung cancer, or to blood cancers. Stage, biomarkers, prior treatment, brain metastases and performance status don't affect the label. Each label has a written reason of a sentence or so, quoting the deciding words where there are any.

### 6.2 Which trials are labelled

- **Held-out sample:** 300 of the snapshot's treatment trials, chosen by ordering every treatment trial by `sha256("0001:" + nctId)` and taking the first 300. It's reproducible, and independent of the search and its vocabulary. `npm run search:sample` writes the skeleton.
- **Dev pool:** trials outside the held-out sample that the *first* vocabulary drops, and whose title or eligibility text contains `non small cell`, `nsclc`, `lung cancer`, `lung carcinoma`, `lung adenocarcinoma` or `thoracic` (normalized). Frozen once written, so later vocabulary changes can't reshape it.

  *Amended in plan:* the dev pool is drawn by a fixed text rule, not by the first vocabulary, so it can be drawn before any search code exists. It's the treatment trials outside the held-out sample whose normalized title or eligibility text contains one of the phrases above, and whose conditions, keywords and MeSH terms contain none of `lung`, `nsclc` or `thoracic`. That's the "mentions it but doesn't name it" pool. If it exceeds 80, the first 80 by `sha256("dev:" + nctId)` are used.
- Labels live in `evals/cases/search/nsclc.json`:

```ts
interface SearchLabels {
  version: 1;
  snapshot: string;            // "2026-10"
  cancerType: "nsclc";
  labels: { nctId: string; set: "heldout" | "dev"; relevant: boolean; reason: string }[];
}
```

- `npm run search:show -- <NCT ID>` prints what a labeller needs: title, conditions, keywords, MeSH terms and eligibility text. **The labelling commands can't see the search.** They don't import `src/search/`, and a boundary test checks that, as the prescreening repository's labelling tool is kept from the parser. A label is written before its trial's search result is known.

### 6.3 Running it

`npm run search:eval` loads the snapshot, vocabulary and labels, runs the cancer-type stage on every labelled trial, and writes `evals/results/search/NN-<first 12 hex of vocabularySha256>.json`, numbered by `nextRunFile` in `evals/run-file.ts`, which accepts only a hex suffix (amended in plan):

```ts
interface SearchEvalResult {
  version: 1;
  snapshot: { month: string; sha256: string };
  vocabularySha256: string;    // of the cancer-type and generic files, concatenated in a fixed order
  labelsSha256: string;
  rows: { nctId: string; set: "heldout" | "dev"; relevant: boolean; kept: boolean; reasons: string[] }[];
  heldout: Metrics;
  dev: Metrics;
}

interface Metrics {
  labelled: number; relevant: number; kept: number; keptRelevant: number;
  recall: number; recallInterval: [number, number];   // Wilson 95%
  precision: number;
  byReason: { reason: string; kept: number; keptRelevant: number }[];
  misses: string[];            // relevant and dropped, by NCT ID
}
```

Only the cancer-type stage is measured. Purpose is fixed by the sample, and age, sex and distance are arithmetic, proved by unit tests.

### 6.4 Reporting

`docs/search.md` reports held-out recall with its interval, precision, the per-reason breakdown, and every held-out miss with its reason. The labeller and the convention's limits are stated beside them. The dev numbers are shown separately and labelled as the set the vocabulary was tuned on.

### 6.5 The bar

Proposed for the gate after measurement: **held-out recall at least 0.95, and every held-out miss read and explained.** Precision has no bar; it's reported. Below the bar, the vocabulary is improved on the dev pool and the held-out sample is scored again, once. A second miss of the bar is a finding for the owner, not a third tuning round.

## 7. Tests

All deterministic, on committed fixtures under `tests/`, never the full snapshot:

- **Trimming:** a committed sample registry response (contacts included) trims to the expected `SnapshotTrial`. Contacts don't survive. A missing required field reports every problem.
- **Serializing and loading:** round trip; byte-identical output for identical input; checksum, count, order and duplicate faults each name the file and line.
- **Registry page request:** URL built from fixed parameters and the token only; errors match `fetchStudy`'s; uses the injected `fetch`.
- **ZIPs:** parsing, ZIP+4, unknown ZIP, malformed line.
- **Vocabulary:** normalization cases ("Non-Small-Cell", "NSCLC,", "nsclcx"), each reason firing and not firing, loader rejections.
- **Search:** each funnel stage on a small hand-built set of trials: purpose with `null`, age units and unreadable limits, sex, the site status rules, missing coordinates, radius `null`, stale and past-completion against the manifest, never the clock. Ordering. The funnel counts agree with the candidates.
- **Committed result:** `tests/evals/search-result.test.ts` re-derives every metric in each committed result from its rows. It checks the rows' labels against the committed label file, the label and vocabulary checksums, and the snapshot checksum against the committed manifest. It doesn't rerun the search, which needs the full snapshot. `npm run search:eval -- --check` does that, and fails if any row differs.
- **Boundaries:** `src/search/` is walked by the network rule (automatic, it has an `index.ts`). It imports no model, parser or screening module. The labelling commands reach neither `src/search/` nor a model.

`npm test` stays under a second.

## 8. Files

New: `src/trials/snapshot-types.ts`, `snapshot-trim.ts`, `snapshot-validate.ts`, `snapshot-load.ts`, `snapshot-write.ts`; `src/search/` (`index.ts`, `normalize.ts`, `vocabulary.ts`, `geo.ts`, `search.ts`, `types.ts`); `scripts/fetch-snapshot.ts`, `fetch-zips.ts`, `search.ts`, `search-sample.ts`, `search-show.ts`, `search-eval.ts`; `data/snapshot/2026-10/`, `data/geo/zcta-2025.csv`, `data/cancer-types/`; `evals/cases/search/`, `evals/results/search/`; `docs/search.md`; tests as in §7.

Changed: `src/trials/registry.ts` (the page request), `src/trials/index.ts` (exports), `tests/boundary.test.ts` (the two new boundaries), `package.json` (the scripts), `biome.jsonc` (ignore `data/snapshot`, `data/geo`), `CLAUDE.md` (layout, commands), `README.md` (one line on what runs), `work/ROADMAP.md` (TREC moves out of 0001).

No new dependencies.
