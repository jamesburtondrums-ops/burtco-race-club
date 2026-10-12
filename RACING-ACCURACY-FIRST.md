# Racing Intelligence — accuracy-first operating protocol
Effective: 12 October 2026

## Direction
Sectional telemetry is **optional supplemental research**, never a prerequisite, negative score, or currently operative training feature. No claim that the predictor has learned automatically or improved its win percentage. Prioritise reliable, free-to-view pre-race information and a fair early-price market benchmark.

## Six practical research layers, in order
1. **Handicap / class / race quality:** as-at official rating, carried weight/allowances, latest winning mark, past performance relative to mark, class, grade and prize value, quality of past opponents. A low mark without matching course/ground fitness is not a recommendation.
2. **Quality of recent and historical form:** beaten distances and margins in context, pace of races where observed, previous jockey/trainer partnerships, run comments, subsequent winners/franked form, incident and stewards' notes. A winning time belongs to the winner; do not attribute it to another finisher.
3. **Race suitability:** surface, going (and changes), exact track configuration and distance, direction/bends/stiff finish, draw, field size, horse's repeated racing position and pace threats. General venue names do not substitute for evidence on comparable track variants.
4. **Trainer/jockey intent as observable evidence:** trainer strike-rates by course/race type/class, 14- and 30-day form (with sample sizes), jockey track record, first-time or repeated partnerships, seasonal targets, layoff pattern. Treat "targeted" or "well handicapped" as a hypothesis without documented support.
5. **Early market and strength of every rival:** confirm declarations, non-runners, full field, quoted book and timestamp, E/W terms, whether our price is materially better than an as-at market probability estimate. No SP substitutions in early-price returns.
6. **Independent source challenge:** OLBG, myracing and The Winners Enclosure for attributable race-specific claims and alternative opinions, not majority voting or a fixed consensus bonus.

## Free-to-view references and limits
- BHA: official handicap guides, available ratings pages, stewards' reports, racecourse and regulatory notes. Use official marks as dated facts, not a claim of free historical bulk feed.
- Racing Post free racecards: declared fields, age, OR, weight, draw, course/distance wins, basic trainer/jockey information, RPR/TS where displayed, some form and commentary. Free account may unlock further viewing; Pro Card features may be paid.
- At The Races: free racecards/results, form and replay archive (publisher says archive includes races since January 2020). Race replays help manual assessment; they are not licensed programmatic position/sectional data.
- Racing TV: publicly displayed racecard/Timeform context and previews; distinguish members-only tools from publicly accessible summaries.
- OLBG, myracing, The Winners Enclosure: public editorial research and counterarguments with publication time, author and race link.
- Prior race result archives with unverified reuse rights (including the existing third-party Kaggle exploratory study) are **not** treated as a cleared automated production data feed.

Free to **view** is not the same as legally free to bulk download, republish or train on. Human research with short original summaries, source URLs and access/publication timestamps is the initial workflow. Apply permissions/source rights before scheduling systematic extraction. Never bypass logins, restrictions or paywalls.

## Minimum research record for a pick
Before the off, save: race date/off/meeting, declaration status and rivals, age and discipline, official mark and class where applicable, trainer and rider, the complete early bookmaker price/time, going/surface/trip, confirmed factual pros, at least one concrete counterargument, the source for each important claim, and what could not be checked. Keep published prices and historic paper bets immutable. Capture separately: market price updates, later comments, and result.

The new private **accuracy-audit** scans published picks and reports which values are structured. Its linked sources/qualitative descriptions are *not* an automated full-field feature store; zero sourced histories means 'not attached', not 'no past runs exist'. A missing non-applicable field (e.g. official rating for an unrated maiden) is not automatically a bad runner.

## Scientific standard before claiming more accuracy
- Archive at least 500 distinct legally usable full-field historical races, minimum 2,000 runner rows, with source provenance and strict 'known before selection' timestamps. Prefer several racing seasons and a wide mix of codes/tracks.
- Use genuine pre-off odds from the same selection time, not SP or prices collected later. Report the quality of the available market baseline and missing quote coverage, including overround.
- Run chronological race-grouped holdouts, never train on a result, retrospective rating or final SP to predict that race; no same-race row leaks. Keep model predictions/feature snapshots frozen and auditable.
- Compare top-selection win strike rate, Brier score and winner log-loss **against the same races** in an early-market baseline; report calibration and uncertainty. Track ROI at the recorded early quote and stake *separately* from SP research; include zero selections/no-bet opportunities to avoid survivorship bias.
- Evaluate profitable-value midshots and E/W longshots separately from high-strike-rate favourites. A 65% strike rate among odds-on runners may still lose money.
- Promote a proposed change only after repeatable improvements on at least two forward-time unseen windows and adequate sample sizes, with no worse calibration and support from an actual pre-off data feed.

## What the existing deep research means
The repository contains exploratory backtest output over 46,551 sampled races / 368,830 runners with walk-forward seasons. In its pooled unseen results, the model's **market-fusion top pick equals the SP-favourite baseline at 35.6% winners and -7.6% SP ROI**. The higher probability/PRIME subset contains many short-priced winners but remains negative ROI. The analysis depends on third-party Kaggle-derived archive and SP, so it is **not confirmation of early-price live-tips performance**, guaranteed access rights or a validated deployable predictor. No model-promotion claim until the above standards are met.

## Current implementation
- `functions/_lib/accuracy-audit.mjs`: pure coverage checks of today's published picks and strict timestamping for manually attached research evidence.
- `functions/api/backoffice/report.js`: authenticated report exposes coverage and priorities.
- `backoffice.js`: private panel presents coverage and missing evidence instead of a showcase of sectional case studies.
- `tests/racing-accuracy-audit.test.mjs`: no duplicate tips, post-lock notes rejected and missing handicap marks flagged.
- Published pick rankings, historic tips, paper ledgers, user PIN and the Race Club main branch remain unchanged.

## Next data work
Create a rights-cleared **as-at daily observation history** from permitted sources, then process each runner and every rival, and test factors individually by Flat turf, AW and Jumps. Prefer improving complete-field availability, timestamping and factual form interpretation over inventing weights or using unverified "inside" trainer motives. 
