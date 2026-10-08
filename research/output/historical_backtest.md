# 500+ Race Historical Backtest

Analysed **10,000 races / 67,898 runners** with a chronological train/test split.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 2795 | 30.2% | +19.3% |
| SP favourite baseline | 2791 | 37.2% | +13.5% |
| Fusion: market + independent evidence | 2795 | 37.2% | +14.2% |
| Value overlay (all qualifying runners) | 4903 | 7.1% | +24.2% |

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
| 18% | 2634 | 38.2% | +14.9% |
| 20% | 2534 | 39.1% | +16.4% |
| 22% | 2409 | 40.0% | +17.5% |
| 25% | 2179 | 41.5% | +18.3% |
| 28% | 1914 | 43.1% | +19.4% |
| 30% | 1758 | 45.2% | +24.5% |
| 35% | 1298 | 48.5% | +27.0% |
| 40% | 942 | 51.8% | +30.2% |
| 45% | 586 | 57.3% | +30.9% |
| 50% | 412 | 61.4% | +27.6% |
| 55% | 249 | 66.3% | +33.5% |
| 60% | 137 | 71.5% | +37.0% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.