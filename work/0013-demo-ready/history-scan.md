# History scan: PHI and secrets

**Date:** 2026-11
**Result: nothing real found.** No secret and no patient data in any commit on any branch. Every hit was read and judged: one test sentinel, public citations, placeholder addresses, a sponsor's public phone number from a registry record, and this slice's own plan text.

**Range:** every ref (`--all`), 277 commits, 12 of them merges. The first is `6847cc6` and the last is `7bf6ccb` (`0013 plan`). The scan ran before this file and the README and demo of this slice were committed.

## 1. Secrets, with gitleaks

```
gitleaks git --log-opts="--all" --redact --report-format json --report-path <scratch>/gitleaks.json .
```

- **gitleaks 8.30.1**, default rules, run locally with nothing uploaded. It reported 266 commits scanned, 34.2 MB.
- **1 finding:** rule `generic-api-key`, `tests/models/fixtures.ts` line 17, commit `6847cc6`, on `SENTINEL_KEY`.
- **Judged: a test value, not a secret.** It's a made-up string beginning `test-sentinel`. Its comment says it is "Not shaped like any provider's key". `tests/server/models.test.ts` saves it as a key and asserts that it never appears in an error or a result.

**Files ever committed** that could hold a key: only `.env.example`. Every version of it has all six variables empty, and `tests/models/env-example.test.ts` holds it that way. No `.env`, `local/`, key or certificate file has ever been committed.

## 2. PHI

Every distinct blob in the history (`git rev-list --all --objects`, unique by object), read with `git cat-file -p` and searched with `grep -Ei` for:
- a date near "DOB", "date of birth" or "born";
- `MRN`, or "medical record number";
- a US phone number;
- an email address;
- a street address;
- an SSN-shaped number.

`.gz`, image, font and PDF files were skipped. The gzipped files are the registry snapshot, public ClinicalTrials.gov records, whose site contact details are the registry's own.

**23 hits in 2,274 text blobs**, all judged:

| Kind | Hits | Where | Judged |
| --- | ---: | --- | --- |
| Email | 18 | `contact@example.org` in versions of `work/0001-trial-snapshot/plan.md`, `tests/trials/fixtures/snapshot-study.json`, `tests/trials/fixtures/README.md`, `tests/trials/snapshot-trim.test.ts` | a placeholder, written into a test fixture in place of the registry's contact |
| Phone | 3 | `work/0000-product/research.md`, commit blob `16c4966` | parts of two DOIs (`s41467-024-53081-z`, `s41467-026-70509-w`), not phone numbers |
| Phone | 1 | `tests/trials/fixtures/study-NCT00106626.json` | the sponsor's public contact number in a ClinicalTrials.gov record (registry content) |
| MRN | 1 | `work/0013-demo-ready/plan.md` | the plan describing this scan |

**The made-up patients** (`evals/cases/`, `e2e/`, test fixtures) carry ages, ZIP codes and personas, and no names, dates of birth or record numbers. That's by design: the convention they were written to says "No name, no date of birth, no employer, no doctor or hospital named" (`evals/cases/patients/AUTHORING.md`).

## What this doesn't cover

- **A name with a diagnosis, in prose.** Names aren't searchable by pattern. The patients have no names, and the repository's text was written for this project. A person reading `work/` and `docs/` is the remaining check.
- **Inside the gzipped snapshot,** beyond its being registry data.
- **Other rules a different scanner might use.** One tool, at its defaults.
