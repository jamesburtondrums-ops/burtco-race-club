# 500+ Race Historical Backtest

Analysed **10,000 races / 67,898 runners** with a chronological train/test split.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 2795 | 31.2% | -6.4% |
| SP favourite baseline | 1629 | 36.2% | -8.7% |
| Fusion: market + independent evidence | 1629 | 37.3% | -4.3% |
| Value overlay (all qualifying runners) | 2873 | 5.2% | -23.4% |

## Targeting / placement signal lift

| Signal | Runners | Win% | A/E | ROI |
|---|---:|---:|---:|---:|
| 2-3lb below last winning OR | 186 | 12.9% | 1.26 | +20.0% |
| target race + jockey upgrade | 92 | 21.7% | 1.22 | +15.3% |
| ability + placement + market top3 | 440 | 28.6% | 1.09 | -3.7% |
| previous RPR 5lb+ above current OR | 1851 | 17.5% | 1.08 | -6.3% |
| owner course strike rate >=15% | 1937 | 17.5% | 1.07 | -12.7% |
| trainer course grade SR >=15% | 2992 | 18.4% | 1.06 | -9.8% |
| ability + placement | 633 | 22.0% | 1.05 | -7.7% |
| trainer course strike rate >=15% | 3179 | 18.7% | 1.05 | -5.5% |
| owner-trainer strike rate >=15% | 3437 | 17.8% | 1.04 | -7.0% |
| trainer course class SR >=15% | 1991 | 18.2% | 1.04 | -19.0% |
| dropping race value >=25% | 1318 | 18.4% | 1.04 | -4.5% |
| horse-jockey win SR >=20% | 1586 | 17.0% | 1.03 | -13.2% |
| same course / same time-of-year prior win | 777 | 19.0% | 1.03 | -10.4% |
| horse-jockey place SR >=50% | 1696 | 17.9% | 1.03 | -8.7% |
| trainer course handicap/non-handicap SR >=15% | 3223 | 18.0% | 1.02 | -14.0% |
| positive pace fit | 2735 | 15.1% | 1.02 | -14.8% |
| return to prior winning conditions | 3227 | 15.2% | 1.02 | -19.1% |
| 2lb+ below last winning OR | 667 | 10.5% | 1.02 | -12.9% |
| positive jockey upgrade | 1726 | 13.0% | 1.02 | -22.9% |
| trainer race-type strike rate >=15% | 2636 | 19.5% | 1.02 | -12.9% |
| same-grade win rate >0 | 3731 | 15.1% | 1.01 | -19.3% |
| distance win rate >0 | 3643 | 15.2% | 1.00 | -21.0% |
| trainer 14d strike rate >=15% | 3300 | 16.1% | 1.00 | -17.6% |
| owner race-type strike rate >=15% | 2974 | 16.6% | 1.00 | -17.8% |
| same-class win rate >0 | 2203 | 15.6% | 0.99 | -18.1% |
| proven going place rate >=50% | 4201 | 16.4% | 0.99 | -17.1% |
| rising race value >=25% | 5247 | 11.6% | 0.99 | -18.9% |
| trainer value-band SR >=15% | 5600 | 15.0% | 0.99 | -21.7% |
| class drop >=1 | 1538 | 13.8% | 0.98 | -23.8% |
| course win rate >0 | 1627 | 15.8% | 0.98 | -16.7% |
| headgear change | 1552 | 9.3% | 0.98 | -27.1% |
| first/second handicap start | 1279 | 10.5% | 0.95 | -14.0% |
| 4-8lb below last winning OR | 249 | 9.6% | 0.94 | -23.7% |
| targeting combo (3+ placement signals) | 841 | 16.2% | 0.94 | -20.1% |
| stable 14d form +10pp above baseline | 1034 | 13.2% | 0.93 | -31.8% |
| 0-3lb below last winning OR | 584 | 11.3% | 0.93 | -26.7% |
| stable 14d form +5pp above baseline | 2353 | 13.5% | 0.91 | -29.6% |
| 9lb+ below last winning OR | 232 | 9.5% | 0.91 | -27.8% |
| 5lb+ below last winning OR | 400 | 9.5% | 0.90 | -26.5% |
| best recent TS 5lb+ above OR | 120 | 8.3% | 0.75 | -23.8% |

## Confidence gates

| Min model P | Races | Win% | ROI |
|---|---:|---:|---:|
| 18% | 1559 | 38.2% | -3.9% |
| 20% | 1487 | 38.7% | -5.5% |
| 22% | 1418 | 39.5% | -5.4% |
| 25% | 1235 | 42.3% | -3.0% |
| 28% | 1055 | 45.1% | -2.4% |
| 30% | 957 | 47.0% | -1.3% |
| 35% | 754 | 49.6% | -3.4% |
| 40% | 539 | 54.0% | -2.5% |
| 45% | 303 | 62.7% | +1.8% |
| 50% | 212 | 68.9% | +5.3% |
| 55% | 148 | 71.6% | +4.7% |
| 60% | 88 | 75.0% | +3.0% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.