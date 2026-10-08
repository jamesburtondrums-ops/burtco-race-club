# 500+ Race Historical Backtest

Analysed **3,200 races / 21,948 runners** with a chronological train/test split.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 896 | 28.2% | +19.8% |
| SP favourite baseline | 895 | 35.3% | +6.0% |
| Fusion: market + independent evidence | 896 | 36.0% | +10.0% |
| Value overlay (all qualifying runners) | 1550 | 7.4% | +19.4% |

## Targeting / placement signal lift

| Signal | Runners | Win% | A/E | ROI |
|---|---:|---:|---:|---:|
| positive jockey upgrade | 775 | 16.8% | 1.08 | +7.0% |
| targeting combo (3+ placement signals) | 453 | 19.4% | 1.04 | +10.2% |
| previous RPR 5lb+ above current OR | 850 | 19.5% | 1.04 | +11.4% |
| distance win rate >0 | 1653 | 18.1% | 1.04 | +18.7% |
| class drop >=1 | 805 | 17.0% | 1.03 | +10.4% |
| return to prior winning conditions | 1474 | 17.4% | 1.02 | +15.1% |
| course win rate >0 | 807 | 18.5% | 1.02 | +17.8% |
| 5lb+ below last winning OR | 232 | 12.5% | 1.01 | +13.4% |
| trainer course strike rate >=15% | 1291 | 19.8% | 0.98 | +5.5% |
| same course / same time-of-year prior win | 372 | 20.2% | 0.98 | +11.1% |
| first/second handicap start | 755 | 13.6% | 0.97 | -4.8% |
| trainer race-type strike rate >=15% | 1087 | 21.0% | 0.96 | -4.2% |
| 2lb+ below last winning OR | 396 | 12.1% | 0.95 | +4.9% |
| trainer 14d strike rate >=15% | 1477 | 17.3% | 0.94 | -8.7% |
| best recent TS 5lb+ above OR | 59 | 13.6% | 0.83 | +4.5% |

## Confidence gates

| Min model P | Races | Win% | ROI |
|---|---:|---:|---:|
| 18% | 831 | 37.8% | +13.5% |
| 20% | 801 | 38.1% | +11.9% |
| 22% | 751 | 39.3% | +13.3% |
| 25% | 690 | 40.6% | +15.0% |
| 28% | 621 | 43.0% | +19.8% |
| 30% | 569 | 45.0% | +24.0% |
| 35% | 448 | 50.7% | +33.1% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.