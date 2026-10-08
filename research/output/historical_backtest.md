# 500+ Race Historical Backtest

Analysed **10,000 races / 67,898 runners** with a chronological train/test split.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 2795 | 30.2% | -8.8% |
| SP favourite baseline | 1629 | 36.2% | -8.7% |
| Fusion: market + independent evidence | 1629 | 37.4% | -3.8% |
| Value overlay (all qualifying runners) | 4447 | 6.9% | -20.9% |

## Targeting / placement signal lift

| Signal | Runners | Win% | A/E | ROI |
|---|---:|---:|---:|---:|
| target race + jockey upgrade | 92 | 21.7% | 1.22 | +15.3% |
| ability + placement + market top3 | 440 | 28.6% | 1.09 | -3.7% |
| previous RPR 5lb+ above current OR | 1851 | 17.5% | 1.08 | -6.3% |
| owner course strike rate >=15% | 1937 | 17.5% | 1.07 | -12.7% |
| ability + placement | 633 | 22.0% | 1.05 | -7.7% |
| trainer course strike rate >=15% | 3179 | 18.7% | 1.05 | -5.5% |
| owner-trainer strike rate >=15% | 3437 | 17.8% | 1.04 | -7.0% |
| same course / same time-of-year prior win | 777 | 19.0% | 1.03 | -10.4% |
| return to prior winning conditions | 3227 | 15.2% | 1.02 | -19.1% |
| 2lb+ below last winning OR | 667 | 10.5% | 1.02 | -12.9% |
| positive jockey upgrade | 1726 | 13.0% | 1.02 | -22.9% |
| trainer race-type strike rate >=15% | 2636 | 19.5% | 1.02 | -12.9% |
| distance win rate >0 | 3643 | 15.2% | 1.00 | -21.0% |
| trainer 14d strike rate >=15% | 3300 | 16.1% | 1.00 | -17.6% |
| owner race-type strike rate >=15% | 2974 | 16.6% | 1.00 | -17.8% |
| class drop >=1 | 1538 | 13.8% | 0.98 | -23.8% |
| course win rate >0 | 1627 | 15.8% | 0.98 | -16.7% |
| headgear change | 1552 | 9.3% | 0.98 | -27.1% |
| first/second handicap start | 1279 | 10.5% | 0.95 | -14.0% |
| 4-8lb below last winning OR | 249 | 9.6% | 0.94 | -23.7% |
| targeting combo (3+ placement signals) | 841 | 16.2% | 0.94 | -20.1% |
| 0-3lb below last winning OR | 584 | 11.3% | 0.93 | -26.7% |
| 9lb+ below last winning OR | 232 | 9.5% | 0.91 | -27.8% |
| 5lb+ below last winning OR | 400 | 9.5% | 0.90 | -26.5% |
| best recent TS 5lb+ above OR | 120 | 8.3% | 0.75 | -23.8% |

## Confidence gates

| Min model P | Races | Win% | ROI |
|---|---:|---:|---:|
| 18% | 1561 | 38.2% | -3.4% |
| 20% | 1500 | 38.8% | -4.2% |
| 22% | 1419 | 40.0% | -3.2% |
| 25% | 1257 | 42.0% | -3.0% |
| 28% | 1072 | 44.0% | -5.1% |
| 30% | 978 | 45.9% | -3.5% |
| 35% | 769 | 49.2% | -3.7% |
| 40% | 547 | 53.4% | -3.4% |
| 45% | 319 | 62.1% | +1.9% |
| 50% | 215 | 69.3% | +6.3% |
| 55% | 158 | 71.5% | +5.4% |
| 60% | 91 | 70.3% | -3.1% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.