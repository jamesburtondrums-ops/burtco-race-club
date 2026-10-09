# Racing Intelligence — historical research and validation protocol

Research review: 9 October 2026. The live paper-bet ledger and public tips
continue running separately from this shadow research project.

## Data status

Current paper ledger: 33 selections from two dates (8–9 October 2026).
Sourced complete historic run archive: **0** verified runner histories.
The project has **not** yet backtested 500+ full races and must not claim
an improvement in win percentage. This is a research protocol, not a
self-training predictor.

## What additional evidence means

1. Handicap rating versus performance: store the **as-at** official mark,
   carried pounds, allowances, headgear changes, penalties, class, prize,
   and the contemporary BHA performance figure, with timestamps.
   Retrospective BHA collateral reassessments must not leak into prior
   prediction dates.
2. Running style: use previous in-running comments to identify leaders,
   prominent racers, mid-division and hold-up horses. Require repeated
   observations, with separate flags for slowly away, hampered, ran wide,
   pulled hard, jumped poorly, stayed on and weakened.
3. Pace map: map every runner, not just tips, and model whether a sole
   leader has an uncontested pace, whether multiple leaders force a fast
   tempo, or whether the field has no natural leader. Low coverage = unknown.
4. Track: use course **configuration**, not venue name alone. Separate
   Newmarket Rowley Mile and July courses, straight from round, track
   direction, first bend, gradients, turf from AW, trip, rail and going.
   Draw advantages require comparable historical groups.
5. Fitness and stable: recent runs, absence, first/second run since break,
   jockey partnership and trainer performance in precisely that code,
   class, course and distance. Shrink estimates from small samples.
6. Time and sectionals: use only sourced actual furlong splits and
   race-specific finishing-speed par. Adjust for ground/weight/wind/rail
   changes where the required values actually exist.

## Authoritative research references

- BHA handicap guide:
  https://www.britishhorseracing.com/regulation/guide-to-handicapping/
- BHA performance interpretation:
  https://www.britishhorseracing.com/regulation/performance-figures/
- BHA time and sectional tools:
  https://www.britishhorseracing.com/regulation/handicapping-tools/
- BHA historic mark adjustments:
  https://www.britishhorseracing.com/regulation/adjusting-handicap-rating/
- Timeform early-position maps:
  https://www.timeform.com/horse-racing/features/previews/timeform-analysis-pace-maps---1062016
- Racing Post form feature definitions:
  https://help.racingpost.com/hc/en-us/articles/17650396440861-Smart-View-How-to-read-this-card
- Timeform run-to-form:
  https://www.timeform.com/horse-racing/features/guides/run-to-form-572017

BHA and publisher materials are educational references, not permission
to bulk scrape their commercial content. The BHA's terms prohibit
unlicensed commercial automated data extraction.

## Licensed observations import

The private archive lives at
functions/_private/racing-historical-runs.json and can be fed using
scripts/import-racing-research.mjs (DRY RUN BY DEFAULT).

Accepted source JSON envelope fields:
- sourceRights: licensed, open-licensed or owner-supplied.
- permissionReference: link or description of the reuse rights.
- allowCommentReuse: true only where the written permission covers comments.
- runs: 1–5,000 objects, each with horse, date, course, raceTime (HH:MM),
  sourceUrl, sourceCheckedAt, and optionally source-cleared running
  comment, going, surface, OR, performance figure and finishing position.

The importer checks dates, URL provenance, duplicate keys, rights flags,
future timestamps and result fields. It will not overwrite an existing run.

Dry run:
  node scripts/import-racing-research.mjs your-file.json

Apply ONLY after verifying the source licence:
  RACING_RESEARCH_IMPORT_ACK=PERMISSION_CONFIRMED node scripts/import-racing-research.mjs your-file.json --apply

Possible candidate archives for permission review (not downloaded):
- RacingFormBook past results CSV since 2016:
  https://www.racingformbook.com/single-csv-racing-results/
- Betfair historical Starting Price archives:
  https://promo.betfair.com/betfairsp/SP_history.html

SP history supports a market benchmark but cannot create running-style
or trainer-course histories by itself.

## Qualification gate before any accuracy claim

- 500+ verified full-field historic races, 2,000+ participant outcomes
  and 1,000+ attributable prior in-running notes.
- At each simulated tip, use data **only from before that race**. Group
  all horses within their race, and reserve later calendar periods as an
  untouched test set (walk-forward validation).
- Compare new features against timestamped pre-race market probabilities
  and the existing live-tips model using the SAME race set.
- Report strike rate, profit/ROI, calibrated win probability, Brier score,
  log loss, top-three rate, coverage and uncertainty intervals.
- Separate Flat/Jumps, handicaps/non-handicaps, turf/AW, grades, distance
  and odds bands; verify stability year to year.
- Add features incrementally and use ablation tests so changes in outcome
  can be attributed to pace/track/handicapping/notes rather than overfit.
- **Never** promote a research factor to production because it looks good
  on yesterday's winners. Require held-out improvement and check failure
  periods.

## Monitoring and governance

The existing scheduled workflow records research-data coverage and daily
paper returns when they change. It does not automatically ingest protected
race comments or self-train. New external evidence should be reviewed on
a recurring schedule, with links, dates, sample sizes, independent tests
and a clear promote/reject reason.
