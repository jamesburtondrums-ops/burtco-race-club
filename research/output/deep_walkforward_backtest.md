# Deep Multi-Season Walk-Forward Backtest

Analysed **46,551 sampled races / 368,830 runners** spanning 2019-2026, with rolling unseen-season tests.

## Multi-season confirmation

Walk-forward test years: 2023, 2024, 2025, 2026
Pooled PRIME-55: 1026/1537 winners (66.8%).
20/1+ longshot model: 843/5791 placed (14.6%), EW ROI -26.5%.

## Unseen-test performance

| Method | Bets | Strike rate | ROI at SP |
|---|---:|---:|---:|
| Form/placement model (no market) | 13027 | 27.9% | -12.9% |
| SP favourite baseline | 11338 | 35.6% | -7.6% |
| Fusion: market + independent evidence | 11338 | 35.6% | -7.6% |
| Value overlay (all qualifying runners) | 32275 | 7.5% | -23.8% |

## Targeting / placement signal lift

| Signal | Runners | Win% | A/E | ROI |
|---|---:|---:|---:|---:|
| ability + placement + market top3 | 1994 | 30.1% | 1.18 | -1.0% |
| ability + placement | 3293 | 21.6% | 1.17 | -1.9% |
| previous RPR 5lb+ above current OR | 10423 | 16.4% | 1.10 | -12.5% |
| 2-3lb below last winning OR | 2010 | 10.0% | 1.07 | -15.3% |
| target race + jockey upgrade | 793 | 16.3% | 1.07 | -10.6% |
| targeting combo (3+ placement signals) | 6413 | 15.5% | 1.05 | -14.3% |
| same course / same time-of-year prior win | 6716 | 16.2% | 1.05 | -15.7% |
| jockey RTF +3lb recent | 18285 | 13.4% | 1.03 | -22.6% |
| historically favourable draw tertile | 2379 | 12.9% | 1.03 | -24.1% |
| trainer race-type strike rate >=15% | 17035 | 18.1% | 1.03 | -19.5% |
| owner-trainer strike rate >=15% | 24323 | 15.2% | 1.03 | -16.8% |
| trainer 14d strike rate >=15% | 24765 | 15.0% | 1.02 | -20.8% |
| course win rate >0 | 15559 | 13.8% | 1.02 | -17.2% |
| trainer RTF +5lb recent | 9105 | 14.5% | 1.02 | -18.9% |
| stable 14d form +10pp above baseline | 8834 | 13.8% | 1.02 | -24.4% |
| trainer course handicap/non-handicap SR >=15% | 21990 | 16.4% | 1.02 | -20.1% |
| horse-jockey place SR >=50% | 13194 | 15.4% | 1.02 | -17.1% |
| horse-jockey RPR uplift +3lb | 10289 | 14.1% | 1.02 | -18.5% |
| positive jockey upgrade | 13810 | 11.9% | 1.02 | -19.0% |
| trainer value-band SR >=15% | 41653 | 13.7% | 1.02 | -20.4% |
| first/second handicap start | 10248 | 9.8% | 1.02 | -16.9% |
| owner race-type strike rate >=15% | 21115 | 14.9% | 1.02 | -17.9% |
| horse-jockey win SR >=20% | 12629 | 14.4% | 1.01 | -18.7% |
| trainer course grade SR >=15% | 21111 | 15.9% | 1.01 | -21.0% |
| owner course strike rate >=15% | 14761 | 14.5% | 1.01 | -18.2% |
| return to prior winning conditions | 24673 | 12.8% | 1.01 | -21.0% |
| trainer course strike rate >=15% | 20903 | 16.5% | 1.01 | -21.6% |
| trainer course class SR >=15% | 14853 | 16.0% | 1.01 | -21.4% |
| stable 14d form +5pp above baseline | 18587 | 13.2% | 1.01 | -23.4% |
| 2lb+ below last winning OR | 6262 | 9.3% | 1.01 | -21.6% |
| trainer RTF +3lb vs baseline | 14805 | 12.9% | 1.01 | -21.5% |
| trainer RTF +3lb recent | 16542 | 14.0% | 1.01 | -22.1% |
| proven going place rate >=50% | 30673 | 15.0% | 1.01 | -20.1% |
| positive pace fit | 20752 | 12.9% | 1.01 | -21.1% |
| same-class win rate >0 | 20225 | 13.7% | 1.01 | -19.5% |
| class drop >=1 | 11335 | 13.1% | 1.00 | -20.8% |
| distance win rate >0 | 30355 | 13.0% | 1.00 | -20.4% |
| 9lb+ below last winning OR | 1730 | 9.2% | 1.00 | -28.7% |
| dropping race value >=25% | 16725 | 13.3% | 1.00 | -22.3% |
| clear market shape gap >=10pp | 41537 | 11.8% | 1.00 | -27.5% |
| clear market shape gap >=15pp | 28503 | 12.3% | 1.00 | -31.1% |
| same-grade win rate >0 | 31891 | 12.7% | 1.00 | -21.9% |
| 0-3lb below last winning OR | 5624 | 10.7% | 1.00 | -21.2% |
| rising race value >=25% | 27601 | 10.1% | 0.99 | -26.1% |
| 5lb+ below last winning OR | 3557 | 8.9% | 0.97 | -28.2% |
| 4-8lb below last winning OR | 2522 | 8.8% | 0.96 | -21.8% |
| best recent TS 5lb+ above OR | 1370 | 9.4% | 0.94 | -32.7% |
| headgear change | 14711 | 8.3% | 0.94 | -31.1% |

## Confidence gates

| Min model P | Races | Win% | ROI |
|---|---:|---:|---:|
| 18% | 10965 | 36.3% | -7.4% |
| 20% | 10423 | 37.1% | -7.3% |
| 22% | 9542 | 38.7% | -6.9% |
| 25% | 8316 | 40.6% | -7.6% |
| 28% | 7204 | 42.9% | -6.8% |
| 30% | 6197 | 44.9% | -7.1% |
| 35% | 4590 | 48.8% | -7.5% |
| 40% | 3273 | 53.4% | -6.8% |
| 45% | 2319 | 57.8% | -6.5% |
| 50% | 1423 | 63.2% | -6.3% |
| 55% | 991 | 67.5% | -5.3% |
| 60% | 642 | 72.9% | -3.2% |

## Key integrity rule
The targeting variables are observable placement patterns (mark, class, course/trip return, trainer patterns). They are **not evidence that connections deliberately ran a horse to lower its mark**.

Current-race RPR/TS were excluded from features to prevent hindsight leakage.