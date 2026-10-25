# Formula development, 25 October 2026

Working training and prediction software is isolated from the original model.
The live development dashboard is `v3/public/formula-lab.html`.

Seven models were compared on identical chronological development races.
The strongest later-development result was the learned context blend: 28.03%
winner-first accuracy versus 27.28% for a refitted earlier v3 architecture on
11,010 races. Its probability scores improved and its genuinely chronological
folds improved. These are development results from periods already studied,
not a new independent test or a comparison with frozen production forecasts.

The second cycle failed its recorded larger-price criterion: above 12/1 SP,
winner-first detections fell from 17 to 10, while winner-in-top-three detections
rose from 79 to 95. Place precision did not improve. That cycle was rejected.
The original production selection process remains retained. Candidate A is
preserved as experimental software; it is not approved as a betting model.

## Inputs that now enter the learned algorithm

- Separate turf, AW, hurdle, chase and bumper histories, including transition
  uncertainty and discipline-specific winning handicap marks.
- Prior beaten margins, completion, field size and opposition ratings.
- Earlier achieved RPR/TS, with coverage and historical-version limitations.
- Recency of winning form, mark changes, current trip and conditions changes.
- Descriptive prior-comment indicators and inferred running styles, rival
  front-running pressure and draw interactions.
- Explicit missing-history and connection-coverage measures.

Names retrieve prior records but are not fitted features. Current prices,
favourite status, SP, current-race comments, margins, achieved figures and
results cannot enter ability features. Every race on a date is predicted before
that day's outcomes enter history. Unambiguous card aliases resolve to existing
records; ambiguous origins or people are not guessed.

The algorithm learns feature combinations through boosting and a conditional
race ranker. The second cycle learned its mixture weights from earlier
out-of-fold predictions. It assigned 36.29% to the ranker, 63.71% to deeper
boosting and zero to shallow boosting. No fixed outsider or handicap bonuses
were added. Temperature 0.85 was selected using earlier calibration folds.

## Reproduction

Use a separate Python 3.12 environment and `v3/formula-requirements.txt`.
The original project's requirements and model are preserved. Binary artifacts
must use their recorded software versions.

```bash
python -m pip install -r v3/formula-requirements.txt
python -m v3.acquire v3/workspace-formula/raw
python -m v3.formula_prepare
python -m v3.formula_train
python -m v3.formula_refine
python -m v3.formula_dashboard
python -m pytest v3/tests -q
```

The source hash is
`d437590771d395db0e43ca1c9cfac83fa384de631cc1f1b48671a3aa1d522d2d`.
The source is deltaromeo/horse-racing-results-ukireland-2015-2025, under CDLA
Sharing 1.0. The challenger index retains previous comments and margins, unlike
the old index. Full race identity includes date, course and off time because
provider IDs are reused. This recovers two development races omitted by the old
grouping; every candidate and reference uses the same 31,262-race table.

`formula-protocol.json` and `formula-refinement-protocol.json` preserve the two
development cycles. Completed runs refuse accidental overwrites. Development
commands also refuse to freeze a configuration after its reserved final period
has begun; version a genuinely new protocol and reserve a later period for a
new cycle. The old June–September final period cannot be reset by a new folder.

The full preparation has 297,961 development runner records. The latest
operational form history restored from the archive ends 22 October; the missing
23–24 October archive updates remain disclosed. Updating form does not retrain
parameters or reopen a past test.

## Future complete racecards

Restore the saved experimental runtime into `v3/workspace-formula`, then:

```bash
python -m v3.formula_predict --input complete-card.json --output frozen-forecast.json
python -m v3.formula_verify
```

The racecard uses the existing strict v3 snapshot schema documented in
`v3/README.md`: timezone-aware publication, observation, cutoff and off times,
complete declared runners and source URL. Supply net riding weight in `wgt`,
consistent with the training data. Predictions are field-normalised and appended
to a hash-chained ledger. Expired cutoffs are refused. No bet is placed.

With a fresh archive available, `--refresh-history-through YYYY-MM-DD` rebuilds
form through completed earlier days only, leaving the fitted model unchanged.
Archive date/version limitations still apply; a claim of predictive improvement
requires prospective frozen forecasts and independently collected results.

The reserved future period is 26 October 2026–31 January 2027, minimum 1,000
races. Its results were neither collected nor evaluated here. Model A is frozen
for experimental forecasting; the second cycle has no accepted replacement.
