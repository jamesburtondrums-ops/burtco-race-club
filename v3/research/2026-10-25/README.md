# Sunday 25 October 2026: prospective study

23 active races, 194 active runners, 19 non-runners from 213 declarations. Aintree abandoned because of high winds. All times Europe/London, GMT on this date.

`cards/*-complete.json` and `cards/rp-*.json` are compact factual pre-race source observations. `market-grid.json` contains separate bookmaker price observations, with publication time unavailable. All 23 market active-runner sets matched the declared fields at observation. Quotes are aggregator observations, not confirmed executable offers.

`frozen-predictions.json` is an exported, verified append-only hash chain. Version 1 misread Galway 12:32 Beg Sch as NH Flat and Wexford 15:40 Mdn Hdl as NH Flat. Version 2 corrected those race types before racing. Both versions remain recorded; only version 2 is active. A correction event explains supersession. No outcomes were consulted.

`selection-record.json` freezes three conditional win singles: Simply Natural, Character Testing and Dunsy Rock. Minimum price conditions, selected bookmaker quote, opposing evidence, forecast hash and observation time are retained. No stake placed. Prices never entered ability scoring.

The unchanged experimental v3 artifact and Candidate A shadow model are distinct. Neither has a newly validated market edge; no promotion is claimed. Walk In The Valley was rejected despite both model leads after prior soft-ground evidence weakened the case. Numerical outsiders without adequate form evidence were not promoted.

History ends 22 October. Some Irish bumper records are labelled Flat. Jumping-card last-run dates can omit subsequent Flat starts. Unresolved archive entries with no finish are flagged and excluded from manual form evidence. Exact soft/heavy category counts do not replace the broader wet-ground review. Source publication timestamps cannot be reconstructed from observation times.

2,335 matched archive rows were retrieved for all 213 declarations; some are unresolved entries rather than confirmed starts. The public page explicitly distinguishes these. 731 previous fields provide opposition rating context. Raw historical race comments remain local; public output uses numerical facts and inferred classifications, plus concise human paraphrases.

Daily entry points are `python -m v3.daily_form --folder <dated-folder> --date YYYY-MM-DD`, then `python -m v3.daily_run --folder <dated-folder> --date YYYY-MM-DD --runtime <restored-runtime-folder> --challenger-runtime <formula-runtime-folder>`. Reusing an immutable forecast identifier fails rather than overwriting. `daily_study.py` holds this date's manual decisions; changing them requires a new prospective version, not a rewrite of a frozen selection.

Public deliverables: `v3/public/today.html`, `today.js`, `today.json`. Yesterday's files and production branch remain unchanged except that the development archive homepage gains a link to today's page.
