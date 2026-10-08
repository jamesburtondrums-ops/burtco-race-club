# 500+ Race Historical Backtest

Analysed **10,000 races / 67,898 runners** with a chronological train/test split.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 2795 | 30.1% | +17.6% |
| SP favourite baseline | 2791 | 37.2% | +13.5% |
| Fusion: market + independent evidence | 2795 | 36.9% | +12.7% |
| Value overlay (all qualifying runners) | 4837 | 7.1% | +26.9% |

## Targeting / placement signal lift

| Signal | Runners | Win% | A/E | ROI |
|---|---:|---:|---:|---:|
| positive jockey upgrade | 2574 | 16.0% | 1.07 | +15.6% |
| same course / same time-of-year prior win | 1132 | 21.4% | 1.04 | +23.5% |
| previous RPR 5lb+ above current OR | 2919 | 19.5% | 1.03 | +13.6% |
| trainer course strike rate >=15% | 4461 | 20.0% | 1.03 | +6.5% |
| 2lb+ below last winning OR | 1047 | 12.5% | 1.02 | +12.4% |
| trainer race-type strike rate >=15% | 3645 | 21.0% | 1.01 | +2.6% |
| first/second handicap start | 1873 | 13.3% | 1.00 | +13.0% |
| return to prior winning conditions | 4860 | 16.9% | 0.99 | +5.4% |
| class drop >=1 | 2303 | 16.2% | 0.99 | +3.1% |
| trainer 14d strike rate >=15% | 4592 | 17.8% | 0.98 | -1.4% |
| 5lb+ below last winning OR | 616 | 12.0% | 0.98 | -2.0% |
| distance win rate >0 | 5513 | 17.0% | 0.98 | +3.9% |
| course win rate >0 | 2493 | 17.7% | 0.96 | +8.2% |
| targeting combo (3+ placement signals) | 1283 | 17.5% | 0.92 | -1.6% |
| best recent TS 5lb+ above OR | 189 | 10.6% | 0.82 | -10.3% |

## Confidence gates

| Min model P | Races | Win% | ROI |
|---|---:|---:|---:|
| 18% | 2646 | 37.7% | +12.8% |
| 20% | 2544 | 38.6% | +13.9% |
| 22% | 2398 | 39.5% | +15.1% |
| 25% | 2181 | 41.1% | +16.9% |
| 28% | 1917 | 43.6% | +20.4% |
| 30% | 1745 | 44.8% | +21.7% |
| 35% | 1274 | 48.0% | +23.6% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.