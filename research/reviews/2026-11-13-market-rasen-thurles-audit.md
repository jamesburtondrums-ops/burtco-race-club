# Challenger C retrospective audit — 13 November 2026

**Research only; no prospective picks or model accuracy claims.** Sources consulted 2026-11-13 UTC (exact clock time not recorded; do not treat this as an as-at pre-off observation). Facts are short manually extracted references; no third-party full-field data republished in the archive.

## Market Rasen — 12 November 2026, 15:01, Class 5 mares' handicap hurdle
Sources: https://www.racingpost.com/results/35/market-rasen/2026-11-12/930604/ ; https://www.racingpost.com/racecards/35/market-rasen/2026-11-12/930604/

- Result lists 8 starters, good-to-soft, 2m7f16y, 12 hurdles, winner Diamond Grace (OR 95, 11st13lb, 17/2), second Fireball Frenzy (OR 95, 11st13lb, first-time cheekpieces, 7/2 favourite), beaten a neck. The result does not display BHA achieved performance figures.
- The racecard indicates Fireball Frenzy wore cheekpieces for the first time and was on handicap debut; both are categorical audit features, not automatic score bonuses.
- Racecard gives It's Maisy 12st0lb with Oscar Palmer claiming 7lb; result lists 11st7lb. Store declared/nominal weight, allowance and effective weight in distinct fields, then reconcile rather than declaring a source conflict or double-counting a claim.
- Racecard lists Seasmoke as 215 days since previous run; result lists 11st7lb and OR 89. Layoff is a factual readiness input, not a negative grade without horse-specific return evidence.
- Meeting card describes rail movements adding 342 yards for the 15:01 race. Published headline trip and effective measured trip should not be conflated; verify official distance treatment before calculating track par or sectionals.

## Thurles — 12 November 2026, mares' handicap hurdle
Sources: https://www.racingpost.com/results/198/thurles/2026-11-12/933087/ ; https://www.racingpost.com/racecards/198/thurles/2026-11-12/933087/

- **Material identity/timing discrepancy:** racecard is labelled 15:15 while linked result is labelled 14:38, though both use race ID 933087 and the same named race. Result says off time 14:41:51. Treat race ID as provisional join key, and quarantine scheduled/off timestamps pending independent official confirmation.
- Result lists 10 starters, good ground, 2m4f, 3 hurdles omitted, and Mastertown Miss as a non-runner (unsuitable ground). The advance racecard lists 15 runners. Never reconstruct the final active field from the advance card alone.
- Result winner Fratas (OR 115, 11st12lb, 7/2), second Shoda (OR 111, 11st8lb, 100/30 joint favourite), separated by a neck **after a stewards' demotion**. Store first-past-post separately from official finishing order, and only use the official outcome for result audits.
- Three omitted hurdles change the effective jumping test; do not treat this as a standard 12-hurdle course execution observation.

## Handicapping policy verified with BHA
https://www.britishhorseracing.com/regulation/performance-figures/ ; https://www.britishhorseracing.com/regulation/guide-to-handicapping/ ; https://www.britishhorseracing.com/regulation/official-ratings/ratings-database/

- BHA achieved performance figures are race-specific and on the same scale as OR, but distinct from the published handicap mark. BHA states jockey allowances are added back for performance-figure calculations. RPR/TS must not be stored as BHA PF.
- Weekly published OR updates and retrospectively revised PF require an explicit as-of timestamp and source version. No numeric BHA PF imported in this audit.

## Shadow gates proposed (not deployed)
1. Reject race-ID/date/time joins if schedule and result disagree without independently verified resolution.
2. Store nominal and effective weights, allowance, and any penalty separately; verify whether the result weight already nets the allowance.
3. Preserve declared, active and non-runner lists as separately timestamped snapshots.
4. Distinguish first-past-post, stewards-amended official winner, and void/abandoned status.
5. Record actual omitted obstacles and rail movements before pace/par analysis.

**Coverage delta:** 2 race-level research reviews; 0 new permission-cleared runner rows; 0 prospectively frozen Challenger C cards; 0 BHA achieved PFs; 0 validated market-baseline tests. Historical totals remain unreconciled. Models A/B1 and paper ledger unchanged.
