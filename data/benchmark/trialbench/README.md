# NIH-TrialBench, the NCI vignettes

Written by `npm run benchmark:import` from the release named in [`../sources.json`](../sources.json), except `profiles.json` and this file, which are written by hand. Slice 0008 measures the search and the deeper check on them ([`work/0008-benchmark/`](../../../work/0008-benchmark/)).

- **`vignettes.json`:** the 41 vignettes from NCI, the oncology share of the 126, verbatim. Each is a synthetic patient written by an NIH investigator around a target trial.
- **`labels.json`:** the 395 clinician labels on NCI vignettes: recommended, eligible but not recommended, or ineligible, with the clinician's comment where there is one. The pairs labelled were TrialGPT 2.0's top ten for each vignette.
- **`trials.jsonl.gz`:** the 106 trials those labels name, all 13 targets among them. Title and criteria are the release's `raw/trial_search_space.jsonl`. Conditions, phases, ages and sex come from its `trials/NCT*.json`, the repository's updated copies, whose criteria differ for 14 of the 106.
- **`profiles.json`:** each vignette's cancer type (spec 0008 §4.1), age and sex. Three don't state everything, and their profiles say what was used.

**The license.** Public domain, by the National Library of Medicine's notice at the pinned commit. Please cite: Fang Y, Jin Q, et al., "Towards AI-Assisted Clinical Trial Matching: Practical Considerations, Multicenter Evaluation, and Real-World Deployment", arXiv:2609.01202.
