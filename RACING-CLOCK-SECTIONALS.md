# Racing Intelligence — Horse clock and sectional evidence

Reviewed 12 October 2026. This is a **private descriptive research capability**, not an automatically licensed tracker or demonstrated improvement in predictions.

## Practical sources checked

1. **Racing TV RaceiQ**: https://www.racingtv.com/raceiq and https://www.racingtv.com/raceiq/sectionals-tab — free-to-view race-specific individual total times, furlong-level split times, in-running positions, cumulative time behind leader, 0–20 mph, peak speed, finishing speed %, race Time Index and course-specific par. Historical coverage from March 2023 GB and January 2024 Ireland. **Important:** free to VIEW does not grant permission to bulk extract, rehost, train a commercial model or automatically populate the full archive.
2. **At The Races Sectional Times**: https://www.attheraces.com/sectionalsinfo — sectional grids, pace bars, early-middle-late speed, efficiency grading and published optimums; specific track coverage/time lags. Complementary to RaceiQ.
3. **Sporting Life race results**: https://www.sportinglife.com/racing/results/2026-10-01/newcastle/941151/download-the-racecourse-app-raceday-ready-handicap — independently check the published race-winning clock and finishing order. Recorded `1m 41.03s` in the sample.
4. **BHA historic margin conversion**: https://www.britishhorseracing.com/press_releases/british-horseracing-authority-introduces-new-finishing-distances-and-alteration-to-their-calculation/ — official photo-finish lengths-per-second formula depends on Flat/Jumps, going and surface. Recheck current course-specific conventions before applying to modern Tapeta; do **not** blindly assume 6 lengths/second for every race.
5. **Timeform sectional archive**: https://www.timeform.com/horse-racing/shop/sectional-times — licensed downloadable historical sectional files, including past manually compiled timings; current data types and rights need confirmation before import.
6. **TPD Live & Post-Race API**: https://www.totalperformancedata.com/live-pr-api-2/ — direct licensed industry timing feed and archival sectional histories; pricing on request.
7. **Horse Racing API race results**: https://apihorseracing.com/documentation/races-result — API includes `winning_time`, full field `position`, `beaten_distance` (margin behind preceding horse). Archive tier advertised at **$99/month**. This does **not** supply GB/Irish sectional splits according to its current public coverage table, so should be paired with licensed RaceiQ/TPD for sectionals. https://apihorseracing.com/data-coverage

## Two verification tiers

### A. Individual horse clock (preferred)

Use RaceiQ/TPD `individual time`, even when it differs by hundredths from published winning time. Compare runner and winner on the SAME race, then compare a horse's own prior starts only once trip, surface, going, class, weight and track geometry are accounted for.

### B. Official winner time + finishing margins (fallback)

1. Parse `1m 41.03s` to **101.03 seconds**.
2. Distinguish a runner's margin behind the **previous finisher** from the **cumulative margin behind the winner**. Add all preceding margins to obtain the latter.
3. Determine a documented lengths-per-second scale suitable for the **actual race code, surface and going**.
4. Approximate runner time as `winner time + cumulative lengths behind winner / valid lengths-per-second scale`.
5. Label as **margin-derived estimate**, not a measured individual time or a sectional. An unverified conversion scale means **unavailable**, not a default 6.
6. Cross-check exact runner identity; same names with different ages, trainer identities or different horse IDs must never be merged automatically.

## Actual case: Sailor's Return (Newcastle, 1 October 2026, 18:30)

Direct source: https://www.racingtv.com/results/2026-10-01/newcastle/1830

- Official winning time (Dalamara): 101.03 s. RaceiQ individual time: Dalamara 101.02s, Sailor's Return 101.07s.
- Sailor's Return finished **second by a neck**, was **10th** at the first six furlong checkpoints, **8th** at the seventh and **2nd** after the eighth.
- Last two furlongs: Sailor's Return **23.57 s** (11.59+11.98), Dalamara **24.08 s** (11.72+12.36).
- Sailor's Return's recorded closing FSP **106.9%**, rank 1 of 10. Peak speed **39.11 mph**, also rank 1 of 10.
- Evidence supports *a powerful late effort in this particular event*, not an automatic universal closer advantage, probable future finish or proven trainer intent.

## Actual case: Flowstate (Newcastle, 25 September 2026, 19:45)

Direct source: https://www.racingtv.com/results/2026-09-25/newcastle/1945

- Lord Capulet won in 86.25s. Flowstate finished **6th in 87.53s**.
- RaceiQ checkpoint positions of Flowstate: **5–5–6–6–4–6–6**. Despite reaching fourth after 5f, his closing effort failed to sustain progress.
- Closing 2f: Flowstate **25.42s** vs Lord Capulet **24.48s**, a **0.94s slower closing segment**.
- Flowstate's FSP **97.50%**, rank 6 of 11. Top speed **39.55mph**, rank 11 of 11.
- This creates a material research concern for any new 7f Newcastle value recommendation. Race shape, handicap mark and returning fitness must be considered before assuming a bounceback based on historical C&D wins.

The factual examples are stored in `functions/_private/racing-manual-sectionals-example.json` and displayed inside the PIN-protected private back office. These observations were first captured after the 12 October public paper-price snapshot, so **they MUST NOT be claimed as evidence used by the original frozen 12 October selection**.

## Code and full-history readiness

- Pure, tested evaluator: `functions/_lib/race-time-analysis.mjs`
- Historical research import: `scripts/import-racing-research.mjs`, now accepts `winningTimeSeconds`, `horseTimeSeconds`, `lengthsBehindWinner`, `marginBehindPrevious`, `timingSourceUrl`, optional licensed `sectionals`, `finishSpeedPercent`, `parFinishSpeedPercent`. Rights and source verification enforced for sectionals.
- Private dossier output: `functions/api/backoffice/report.js`, `backoffice.js`
- Tests: `tests/race-time-analysis.test.mjs` in `trainer-view-tests.yml`
- To import full history legally, obtain terms or licensed feed from RaceiQ/TPD or Timeform, verify historic identities and timestamp each observation. Until then the private bulk historical run archive remains empty.
- Selection process only graduates a signal when enough full fields are historically available and time-forward / holdout testing shows improvement beyond market-based baseline. A genuinely fast individual split matters only versus opponents, course par, race shape and context.

