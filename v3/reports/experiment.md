# Racing Intelligence v3 — completed experiment

Decision: **RETAIN_ORIGINAL**. Candidate: **ensemble**.
Reserved period: 2026-06-04 through 2026-09-30.
4,785 races; 43,987 runners.

| Method | Top one | Top two | Top three | Race log loss | Race Brier |
|---|---:|---:|---:|---:|---:|
| v3 candidate | 27.21% | 46.52% | 61.27% | 1.9653 | 0.8295 |
| Uniform | 13.46% | 26.19% | 38.47% | 2.1355 | 0.8708 |
| Retrospective starting-price reference | 34.13% | 55.35% | 69.44% | 1.7503 | 0.7679 |

This is a one-use, later-period archive evaluation. Archive reconstruction is provisional: source snapshots and contemporaneous declaration/ratings versions are unavailable.

Promotion blockers:
- Archive has no pre-race snapshot timestamps or versioned ratings.
- Archive supplies complete starter fields; earlier declared fields and non-runner timing are unverified.
- No complete, timestamped pre-race bookmaker baseline or executable early prices.
- No identical-race frozen original probability forecasts.
- No demonstrated paired accuracy and probability-error improvement over the SP reference.

Early-price returns, paid-place profitability and drawdown are unavailable without timestamped executable prices and bookmaker terms. Top-three finishing frequency is not a paid-place strike rate.

Models learn from independent ability features. Current starting prices are excluded from inputs and shown only as a retrospective reference. No 25% reference is treated as an identical-race original-model result.

Data: Delta Romeo, Horse Racing results — UK/Ireland 1988–2026, Kaggle; Community Data License Agreement – Sharing 1.0. Exact download URL and SHA-256 are in data-source.json.

The SP comparison covers 4,784 races with complete prices; one reserved race lacks a complete market. On that identical subset, v3 top-one accuracy is 27.22%. The paired v3 minus SP top-one difference is -6.92 percentage points (95% whole-day bootstrap interval -8.22 to -5.54).
