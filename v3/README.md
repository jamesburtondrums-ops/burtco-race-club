# Racing Intelligence v3

This is functioning learning and prediction software on `racing-intelligence-v3`, branched from the original `racing-intelligence` code. Original application files, selection records, workflows and production hosting are preserved. Development is local; no production deployment or promotion is performed.

## Open the dashboard

From the repository root:

```powershell
.\.venv-v3\Scripts\python.exe -m v3 serve
```

Open <http://127.0.0.1:8763>. The dashboard compares candidate validation results, displays the single reserved-period evaluation and promotion blockers, accepts timestamped future racecards, and records frozen predictions and official results. `v3/reports/experiment.md` is the portable experiment result. Raw data, trained model, histories and the append-only SQLite ledger live in the ignored `v3/workspace/` directory. They remain available on this computer.

## Reproduce a fresh experiment

**Cross-device continuation, 23 October:** the June–September 2026 test has already been opened.
`evaluation-registry.json` now blocks evaluating that period even in a new workspace.
The original instructions below describe the completed experiment; they must not be used
to treat its holdout as new evidence again. The dashboard can show the committed result
without the original ignored workspace.

To restore an operational experimental model on another computer:

```bash
python -m pip install -r v3/requirements.txt
python -m v3 acquire
python -m v3 rebuild-runtime
python -m v3 serve
```

The rebuild fits only the recorded development data, using the already selected architecture
and calibration. It does not rerun candidate selection or score the retired period. Its model
hash is new; the historical test figures belong to the original artifact, not this regenerated
runtime. This distinction is recorded in `runtime-rebuild.json` and shown in the dashboard.
Earlier completed archive races may update history for genuinely future forecasts without
retraining parameters. A new predictive improvement claim requires a new governed cycle
and genuinely new held-out races with sufficient sample size and verified pre-race sources.

Use Python 3.12 and install `v3/requirements.txt` into an isolated environment. The supplied Windows environment uses the bundled Python runtime and its NumPy/Pandas packages.

```powershell
python -m v3 acquire
python -m v3 inventory
python -m v3 prepare
python -m pytest v3/tests -q
python -m v3 develop
python -m v3 evaluate-final
python -m v3 reports
python -m v3 serve
```

`evaluate-final` is intentionally one use per workspace. Once opened, that period cannot be evaluated again or reused for model development in the same workspace. Do not delete the seal or rerun the experiment in another directory and describe its outcomes as new evidence. A failed final run conservatively consumes the period. Keep the source, protocol, frozen configuration and model hashes with the result.

The final period starts on 4 June 2026 and ends on 30 September 2026. Prior experiments had used results through 27 May 2026; those outcomes are development data. October 2026 contains the original system's recent reviews and is excluded from this final sample. This separation establishes an unused later archive evaluation for this experiment, subject to the source limitations below; it does not establish independence from every external analyst who may have seen public results.

## Models and selection

- Regularised logistic regression.
- A conditional race softmax model trained against a one-winner-per-race likelihood.
- Shallow and deeper histogram gradient boosting.
- Feature ablations excluding handicap/ratings and excluding connections.
- Separate turf, all-weather and jumps models with a universal fallback for insufficient samples.
- A probability ensemble of race softmax and gradient boosting.

All architectures use the same prior-only feature builder. Current SP, RPR, TS, finishing time, margins and current-race comments are excluded. Identities are used to retrieve earlier history, never as memorisable model features. Horse form stays separated between jumping and flat racing; surface suitability can use prior turf/AW evidence. Historical statistics include only strictly earlier dates. All same-day races are processed before any of that day's results are incorporated. Source date regressions are counted and the unchanged CSV is indexed chronologically before replay.

Models learn combinations of age, weight, draw, handicap position, form, fitness, course/trip/going suitability and connections. Prior win-rate smoothing reduces noise; smoothing constants are fixed in the preregistered code, not learned from the final period. Validation permutation tests compare evidence blocks within complete races. Missing performance figures, sectionals, measured pace and track configuration are disclosed instead of invented.

Three annual walk-forward folds fit and compare models. A fixed temperature grid is fitted on the resulting out-of-fold predictions. Architecture selection uses the lowest race log loss on later January 2024–May 2026 validation races; top-one accuracy breaks exact ties. The chosen model is refitted on all permitted development races. All model parameters, feature rules and calibration freeze before the final command opens reserved labels. For later test races, earlier completed test races may enter historical form after the day ends; the fitted model and calibrator never change.

The development sample is a deterministic one-third of eligible races from 2019 onward; all earlier eligible results are replayed for history. Every eligible race in the final period is predicted. Complete starter fields, unique horses and one official winner are required. Dead heats, incomplete fields and international meetings outside GB/IRE are excluded under fixed rules; counts are reported. This is not a reconstruction of earlier declared fields or non-runner timing.

## Metrics and promotion

Every race has total win probability one. Race log loss is the negative log of the probability given to its winner; multiclass Brier is the sum of squared runner probability errors per race, averaged across races. Top-one, top-two, top-three, the selected horse's top-three finishing frequency, calibration and race-type/field-size segments are reported. Confidence intervals resample whole racing days to preserve within-day dependence.

Uniform probabilities are a basic baseline. Normalised starting-price probabilities appear only as a **retrospective reference** on the identical subset with complete prices; they are not pretended to be available at an earlier prediction cutoff. Early-price ROI, paid-place returns and drawdown are unavailable without verified executable early odds and bookmaker terms. Original published selections cannot be compared on archive races lacking identical-race frozen original forecasts; the historic 25% figure is not substituted for such predictions.

Promotion requires a sufficient final sample, paired confidence intervals supporting top-one and log-loss improvement against a verified pre-race baseline, no material Brier deterioration, and point-in-time source provenance. The retrospective archive lacks contemporaneous snapshots and versioned ratings, so it **cannot authorise promotion**, even if provisional accuracy looks attractive. The original model remains the production model. An unexpected result is not automatically treated as a predictable miss.

## Future racecards and official results

Import a JSON envelope with `race_id`, `cutoff`, `off_at`, `published_at`, `observed_at`, `source_url`, `declared_runner_count` and `runners`. All times need explicit timezone offsets. It must satisfy:

```text
source publication <= observation <= actual recording time <= cutoff < race off
```

Each runner accepts `horse`, `trainer`, `jockey`, `sire`, `course`, `type`, `race_name`, `class`, `going`, `dist`, `or`, `age`, `sex`, `wgt`, `hg`, `draw`. Outcomes and extra fields are rejected. Optional `market` records hold `horse`, `decimal_odds`, `observed_at`. Market prices never change independent ability probabilities. Estimated value edges are separate, unproven forecasts rather than instructions to place bets.

```powershell
python -m v3 predict --input complete-racecard.json
python -m v3 record-result --input official-result.json
python -m v3 score-records
python -m v3 advance-history
```

The same operations are available in the dashboard. An official result supplies `race_id`, `status: "OFFICIAL"`, HTTPS `source_url`, `published_at`, `observed_at`, and `finishes`, mapping every frozen horse to its integer finishing position (0 for non-finishers). Late field changes need a separately identified snapshot version and invalidate comparison to an unchanged field. Exactly one winner is currently supported.

The SQLite ledger uses immutable update/delete triggers, unique race events and a SHA-256 chain. It provides tamper evidence, not a claim that a local administrator cannot replace an entire database. The real recording clock is checked again after model inference. `advance-history` adds only official records from completed earlier days; it does not retrain model parameters. History recency is displayed with every forecast so a stale archive is visible.

For controlled retraining, write a new protocol that includes the retired period in development and reserves a genuinely later final period, then:

```powershell
python -m v3 new-cycle --protocol next-protocol.json --destination v3/workspace-next
python -m v3 acquire --workspace v3/workspace-next --protocol next-protocol.json
python -m v3 prepare --workspace v3/workspace-next --protocol next-protocol.json
python -m v3 develop --workspace v3/workspace-next --protocol next-protocol.json
```

New data must actually exist before the next final test. Repeated holdout inspection is never a development strategy. There is no automatic production deployment.

## Data and rights

Archive: Delta Romeo, [Horse Racing results — UK/Ireland 1988–2026](https://www.kaggle.com/datasets/deltaromeo/horse-racing-results-ukireland-2015-2025), available under **Community Data License Agreement – Sharing 1.0** according to the retained provider metadata. Preserve attribution and applicable sharing terms when redistributing source or derived datasets. The downloader records the exact URL, downloaded bytes, SHA-256 and retrieval time; it does not claim that the retrieval time is a historical publication time.

Existing repository research is inventoried with source paths, original time fields and content hashes. Vague dates, retrospective review notes and missing version information remain explicitly unverified. A current archive's OR, going, equipment and other entry attributes may have been revised; excluding performance outcomes alone does not eliminate that provenance risk.
