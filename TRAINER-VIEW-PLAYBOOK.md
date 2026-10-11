# Trainer's View — race-placement and course-type research (11 October 2026)

**Status: implemented as a private, read-only research audit; not an automatically validated tip model.** No historic tip is rescored in hindsight. The private back office exposes the geometry and evidence record; the public tips page does not publish the selection formula.

## Start from the horse, not the odds

1. **Horse's repeatable characteristics** — observable pace position, early speed, stride/turning profile where licensed telemetry permits, ability to relax and sustain a gallop, hurdle/chase jumping efficiency, course type/handedness, distance, field size, surface, going and fitness phase. Each claim needs dated past evidence. A fast closing section in a slow race is not the same as strong absolute ability.
2. **Why this particular entry?** — public evidence of a return to a suitable track/grade/going, trip change, class relief, a return to a previously successful handicap mark, a different jockey with prior success, recovery interval, headgear or equipment changes, a season campaign and the race's winner's prize and classification. Ask whether owners may value black type for a mare or a juvenile learning experience, but label this as a hypothesis unless publicly documented by connections.
3. **Can it execute today's race?** — shape of all declared runners, genuine pace pressure, draw plus first-bend distance, likely tactical position, running rail/false rail, course geometry, going, weight and capable opponents. Consider a horse's ability to change lead around bends; use a source, not imagined stride telemetry.
4. **What does the clock say?** — source-cleared early/mid/late splits, finishing speed and actual *race-specific* Par FSP, field position through the fractions, ground covered, and jumping lengths gained/lost if available. Compare the same configuration, discipline, trip and comparable going/class. Do not use one generic finishing-speed threshold or average raw sectionals from unlike tracks.
5. **Can the trainer deliver in this exact situation?** — pre-race trainer-by-course/code/class/type, recent runner health/form (with sample sizes), jockey partnership, whether the stable has an observable pattern in similar races. Shrink small samples to a broad prior; do not equate a single stable runner with proof of a plan.
6. **What is the expected probability and price?** — distinguish winning chance from price value, compare against the *full-field* contemporaneous market, record terms separately for WIN and E/W, and avoid declaring a 20/1 shot a value bet just because of long odds.

## Track taxonomy

Profiles are in `functions/_private/racing-track-profiles.json`. Track attributes are **not exclusive**: a course can be wide, galloping, undulating and stiff at the finish. Track-specific comparisons resolve the actual course configuration, not merely venue name. Flat and jumps are separate, as are Newmarket Rowley Mile and July Course. Kempton Polytrack inner circuit (5f, 9f, 10f) and outer circuit (6f–8f) must remain distinct. Check rail movements, stalls, going and actual trip on race day before making a numeric pace/draw claim.

The current library has 17 sourced layout profiles. Labels are qualitative geographic facts, NOT measured performance advantages or automatic handicapping adjustments. Unmapped Irish venues remain unclassified rather than inferred.

## Required retrospective evidence per previous race

`horse, date, course, raceTime, trackVariant, discipline, distanceFurlongs, surface, going, finishingPosition, jockey, trainer, sourceUrl, sourceCheckedAt`.

Optional (only when genuinely sourced and licensed): `officialRating, raceClass, performanceFigure, sectionals, finishSpeedPercent, parFinishSpeedPercent, sectionalSourceUrl, parSectionalSourceUrl`. Historical observations must be recorded before the target race date when used in backtests. For actual/par sectional imports, the import envelope also requires `allowSectionalReuse: true` and verified source URLs; this is permission to use machine-readable data, not automatic permission to scrape a public display.

The read-only `assessEntryHypotheses` function reports potential entry logic, not the trainer's private intentions. `trackPerformanceEvidence` compares sourced directly matching runs and broadly similar configurations and refuses to claim reliability from one or two anecdotes. In the absence of licensed data it reports **insufficient evidence**, not an adverse score; missing sectionals alone must never exclude an otherwise compelling runner.

## Prospective selection standard to implement as data becomes available

- **High-probability candidates:** credible class/form ability *and* repeatable fit to course/ground/trip *and* a plausible uncontested race execution. Competition and implied chance must be evaluated even if the public odds are short.
- **Value E/W candidates:** demonstrable upside against the actual opposition and a place probability supported by field shape, track suitability, going and bookmaker-specific offered place terms. A fourth can win a four-place E/W stake, but not our existing paper ledger's fixed top-three terms.
- **Longshots:** require a coherent evidence-based route into the first paid places rather than simply odds above 20/1. Price and terms alone are not horse-form evidence.
- **No-data policy:** mark uncertainty clearly and permit manual review. Do not create an overly strict binary exclusion based solely on missing premium data.
- **Freeze pre-race decisions:** store observation timestamps, odds source and decision rationale. No post-event explanations can be relabelled as pre-event signals.

## Testing standard

Use 500+ independent *full-field* race records and 2,000+ runner observations **with rights-cleared covariates**, strictly time-ordered by meeting and race. Benchmark against saved market probabilities and earlier selection rules on the same races, not yesterday's winning horses. Ablate track geometry, pace, sectionals, class/handicap placement and trainer/jockey separately. Report calibration (Brier/log loss), strike rate by odds band, each-way place strike rate, ROI at genuine prices and terms, and uncertainty intervals. Do not claim an improved win percentage without this held-out evidence.

The current private archive contains zero licensed full-run records or licensed sectionals. RaceiQ publishes public display data going back to 2023 in Britain / 2024 in Ireland, but browser visibility is **not** an API or commercial reuse licence.

Reference documentation:
- https://www.attheraces.com/course-guides/Newmarket
- https://www.attheraces.com/course-guides/York
- https://www.attheraces.com/course-guides/Chepstow
- https://www.attheraces.com/course-guides/Kempton
- https://www.racingtv.com/raceiq/par-sectionals
- https://www.racingtv.com/raceiq/sectionals-tab
- https://www.britishhorseracing.com/regulation/handicapping-tools/
