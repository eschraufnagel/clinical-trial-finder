# Trial fixtures

- `study-NCT00106626.json`: one real API v2 response, saved verbatim, from the prescreening repository. It has no locations.
- `snapshot-study.json`: one real API v2 response, NCT07148128, from the 2026-10 snapshot download, chosen because it has US and non-US sites, contacts, keywords and MeSH terms. **Edited:** every contact's and official's name, phone, email and affiliation is replaced by an invented value (`Site Contact`, `555-0100`, `contact@example.org`, `Example Institution`). Nothing else is changed. `tests/trials/snapshot-trim.test.ts` checks that none of those values survives trimming.
