# Racing Intelligence — Evidence archive recovery and enrichment plan

Date: 2026-11-15. Status: research-only implementation specification. Does not change frozen A/B1, tips, or paper ledger.

## Current verified repository state
The 2026-11-15 coverage file records three retrospective race reviews, zero new permission-cleared full-field runner rows, zero individually verified prior-run rows, zero prospectively frozen cards, and unreconciled cumulative totals. The 2026-11-14 file likewise records zero new permissioned rows. Do not convert these references into verified historical observations without provenance and reuse-rights checks.

## Immutable data layers
1. **Source registry**: source_id, original_url, observed_at_utc, captured_at_utc, sha256, publisher, license/reuse_status (permissioned/restricted/unknown), allowed_storage, retrieval_method, evidence_anchor; raw licensed captures stored privately, not committed publicly.
2. **Identity registry**: stable source horse_id/race_id, provider aliases, identity resolution, conflict status, scheduled_off, actual_off, race_date, course, code.
3. **Historical factual observations**: race_id, horse_id, date, class, course, distance, going, surface, draw, OR_as_at, OR_effective_date, carried_weight, claim, penalties, finish, beaten_lengths, field_size, opposition, comment, stewards_note, headgear, rider, trainer, source_id, observed_at_utc, recorded_at_utc, valid_as_of_utc. Distinguish raw facts, derived measures, and human interpretation.
4. **Figure registry**: figure_type (BHA_achieved, BHA_OR, RPR, Timeform, sectional), figure_value, provider, original_publication_time, observed_at, revision_time, race_id, horse_id, calculation_notes. Never equate RPR with BHA achieved performance.
5. **Pace/sectional observations**: observed style from individual prior race, early position, pace competition, distance/track configuration, obstacle omissions, measured sectional, reference par and method/version. Do not manufacture a par or bias when no representative sample exists.
6. **Frozen pre-off assessments**: original immutable card bytes/hash, horse_ids, A/C/E/F/P with source fact links and uncertainty, A/B1 ranks/ties, challenger C shadow flags, alternatives and three pace scenarios, timestamped as-at market quotes. Do not import post-off knowledge into pre-off snapshots.
7. **Post-race official results**: full-field horse_id joins, NRs, amended placings, SP, standard places, forecasts when verified, result-source timestamps.

## Recovery workflow
- Inventory all existing project review, coverage, source capture and frozen snapshot paths; generate a manifest with path, hash, date, race identifiers and rights status. Deduplicate by verified race_id and runner horse_id, not meeting name alone.
- Prioritise 10-20 existing races for source re-verification. Open every runner's individual profile and own last three results; link each run to its actual race result and archive exact short evidence anchors only where rights allow.
- Where rights are unknown, save a URL, timestamp, short independently written finding and restricted status, not wholesale third-party text. Seek a licensed data feed or permission for bulk runner records.
- Reconcile declared field, actual starters, going, equipment, OR, weight, claims, scheduled/actual off and amended steward results. Quarantine conflicts.
- Backfill BHA achieved figures only when explicitly published; distinguish contemporaneous versus revised figures and preserve valid-as-of date.
- Classify pace numerically only after >=2 distinct observed runs. Unavailable is U, never fabricated neutral.
- Audit each import with counts: race reviews, unique verified races, complete fields, permission-cleared runner rows, verified individual last-three histories, BHA figures, sectionals with par, and prospective cards. Keep review-only counts separate.

## Challenger C validation
- Freeze full-field assessments before off; market odds are a comparison baseline, never a grading input.
- Whole-field serious-rival challenge including unexposed horses, matched class/mark/weight, exact headgear change, and three pace shapes.
- Jockey booking signal requires historical comparable rides with denominators, trainer usual riders, jockey usual opportunities, claims and availability, market-implied chance, shrinkage and chronological holdouts. No automatic bonuses.
- Evaluate top1/top3/top5 winner coverage, tied ranks, score sensitivity, SP paper ROI, and calibrated probability forecasts only if probabilities were prospectively generated; evidence index is not probability.
- Require held-out walk-forward and market comparisons before claiming gains. Never rewrite A/B1 or the paper ledger.

## First delivery acceptance criteria
- Machine-readable archive inventory with zero invented counts.
- One fully reconciled historical race with source links and every active runner, where rights permit.
- Every imported observation has horse_id, race_id, source_id, observation time, and rights flag.
- An explicit coverage report with verified denominators and quarantine reasons.
- No changes to production selections.
