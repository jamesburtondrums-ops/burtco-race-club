# Racing Intelligence — historical decision-quality audit
**Audit date:** 22 October 2026. **Scope:** the four complete day-level result audits already present in `data/races.json` (15, 19, 20, 21 October 2026). **Status:** retrospective descriptive analysis; not a validated, held-out predictive backtest.

Run `node scripts/audit-racing-model.mjs` from the repository root to reproduce the category, outcome and recorded-withdrawal counts. That script is read-only. These numbers describe the data presently recorded; do not retrospectively change the original selection labels.

## Frozen-original baseline

| Original frozen group | Published runners | Winners | Win rate | Standard E/W places |
| --- | ---: | ---: | ---: | ---: |
| WIN | 16 | 5 | 31.25% | N/A |
| EACH WAY | 7 | 0 | 0% | 2 of 7 |
| Late-added longshot research (not an original WIN/EW bet) | 1 | 0 | 0% | Not credited |
| **All recorded picks/research** | **24** | **5** | **20.83%** | N/A |

The original WIN win-rate has a wide approximate 95% Wilson interval of 16.4%–53.4%. This dataset cannot establish statistical uplift. The normal E/W top-three result is not an actual bookmaker payout, and no stakes or ROI are credited.

Days 16–17 October do **not** have equally complete, standardised, independently verified outcome records in `postRaceAudits`. They are excluded rather than implicitly scored as losses. For 21 October, the stored audit marked Caragio and Credit Forgedd It as user-reported pending confirmation. Racing Post result pages now independently show Caragio **1st at 19:30** and Credit Forgedd It **3rd at 20:30**; the original historical evidence-status fields were **not rewritten**:
- https://www.racingpost.com/results/1079/kempton-aw/2026-10-21/929558/
- https://www.racingpost.com/results/1079/kempton-aw/2026-10-21/929561/

## What the later decision changes actually achieved

The result files contain **four specifically annotated after-publication withdrawals**:
- Major Fortune, originally WIN, 15 Oct: **3rd** (withdrawn before race; not a winner).
- Style King, originally E/W, 19 Oct: **11th** (withdrawal correctly avoided an unplaced runner).
- Daring Plan, originally WIN, 21 Oct: **2nd** (withdrawal avoided a losing WIN outcome).
- Caragio, originally WIN, 21 Oct: **1st** (withdrawal discarded a winner).

For this **incompletely annotated subset only**, the original WIN cohort was **5/16 (31.3%)**. After excluding the three annotated WIN withdrawals, remaining original WINs were **4/13 (30.8%)**. The observed changes **did not improve WIN strike rate** and lost one correct winner. This is not a fair prospective evaluation of all intraday reviews: other late suspensions and price-only actions are not consistently recorded as withdrawal flags.

Other revealing cases, not included in those four flags:
- **Spec Of Light, 19 Oct:** won despite late warning/withdrawal based substantially on shorter price. **Failure of conflating price/value with horse ability.**
- **Danehill Star, 20 Oct:** finished second after an E/W suspension. **Over-cautious place dismissal**, not an independently proved profitable wager.
- **Credit Forgedd It, 21 Oct:** finished third after repeated E/W suspension over reduced price/field uncertainty. **Place-prospect filtering failure**; standard place terms must still be confirmed.
- **Irish Rumour, 21 Oct:** won after being withdrawn from *overnight research* before final publication. **Missed research opportunity**, **not** a missed published selection.
- **Conquer The Breeze, 20 Oct:** finished sixth after a late WIN/NAP withdrawal advised in reviews. The discipline/trip concern was useful, but the result is **not** proof of a general predictive rule.

## Factor-level lessons — evidence strength

**Useful as research triggers (not yet proven coefficients):**
1. Recent evidence matching today's exact surface, trip, class and going: Yordan (15th), Nap Hand and Spec Of Light (19th), Wodao (20th). Evaluate whether the candidate repeats it **relative to the entire field**.
2. Same-discipline form and credible trip/stamina evidence before ranking a chase-to-hurdle switch as NAP (Conquer The Breeze).
3. A current handicap rise must be compared with demonstrated performance and effective jockey claims: Wodao and Caragio still won with penalties/rises. **Do not auto-veto a 5–8lb rise.**
4. Early identification of opposition, declared runners and real E/W places improves the **completeness** of analysis. It does **not yet** demonstrate better predictions.

**Rules that demonstrably caused bad calls or have no validated benefit:**
1. Reactively suspending a selection because it shortened or drifted (Caragio, Spec Of Light, Credit Forgedd It, Irish Rumour). **Separate confidence from value**; never treat odds alone as invalidation.
2. Stacking individually plausible rival threats until a supported runner is vetoed (Caragio, Danehill Star). Rival quality must be compared quantitatively with the selected runner's **remaining positive evidence**.
3. Treating a short, noisy trainer/jockey 14-day strike rate or a bare rating/weight change as dispositive. **No observed sample supports numerical weights**.
4. Counting near misses as WIN successes, dropping revoked winners from original results or evaluating using information observed after the off. **Forbidden for accuracy claims.**

## Changes to use from the next new publication

A. **Keep two separate decisions per frozen selection.** `abilityDecision: RETAIN | REVOKE` and `valueDecision: GOOD | PRICE_TOO_SHORT | TERMS_UNVERIFIED`. A price-related problem must not rewrite the first decision.

B. **Require a causal, source-timestamped new fact for ability revocation.** Confirm going/withdrawal/trip, revisit *every* remaining runner, and explain why the original strongest positive no longer holds. An increased opponent count or generic caution is insufficient.

C. **Maintain all decision stages, including rejected candidates.** Save original frozen classification, every subsequent decision with clock time/evidence, the final pre-off state, the result and its verification. Backtest both original and latest-pre-off strategies on the **same denominator**; missed winners must be counted.

D. **For E/W, log exact runner count and bookmaker paid places/fraction** with observation times. Without verified terms, mark the offer `TERMS_UNVERIFIED`, not the horse `LOW_PLACE_ABILITY`.

E. **No new predictive scoring coefficients until a hold-out test.** Lock candidate features and proposed rule changes now; collect at least ~100–200 further *chronologically frozen* selections, with results and candidate/rival data (more is preferable). Report win strike, E/W paid-place rate, Brier/log-loss once pre-race probabilities exist, and error bars. Compare to a meaningful baseline (market-implied probability with overround handled, or fixed original process). Calibrate only on historical training periods, evaluate chronologically later periods.

F. **No actual or paper bets.** Early quoted odds, SP, hypothetical returns and accepted prices must remain distinct; the cleared ledger must never be populated from this audit.

## Data integrity and limitations

- The audit is read-only; it does not modify `data/races.json`, historical snapshots, results or the cleared paper-bet ledger.
- `postRaceAudits` captures only four fully tabulated result dates and some withdrawal flags are missing. **No comprehensive 500-race historical backtest has yet been completed.**
- Missing runner counts for some early E/W records prevent independent reconstruction of full exact bookmaker paid places; recorded 6th/9th/11th/12th outcomes are unplaced regardless.
- Independent result corroboration for Caragio and Credit is documented above, but original result provenance remains frozen.
- The current `selection-quality.mjs` is a source/evidence documentation guard, **not** an empirically trained horse-racing forecasting model. A time-split backtest is required before claiming uplift.
