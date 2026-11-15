# Challenger C shadow review — 15 November 2026 UTC

Retrospective research of races held **14 November 2026**. Sources observed during the 15 November 2026 research run (approximately 09:00 UTC); observation times are not pre-off timestamps. No result-derived feature is eligible for pre-off replay.

## Wetherby 12:48, Class 3 handicap hurdle, 2m5f56y, good
- Six runners, no non-runners; winner **Who's Going**, 13/8 favourite, Craig Nichol/Gordon Elliott. Runner-up **The Kalooki Kid**, 2/1, beaten 2½ lengths; third **Shantwopointfive**, 11/2, a further 6 lengths behind.
- Result-site narrative describes winner as in touch, not fluent 2 out, taking lead at last and keeping on; runner-up led before being headed at last. This is a *single race observation*, not an established habitual pace style.
- Source: https://www.horseracing.net/results/wetherby/14-11-26 ; independent finish/field check: https://www.oddschecker.com/horse-racing/results/2026-11-14/wetherby ; conditions: https://www.irishracing.com/raceresults/Sat-14th-Nov-2026/Wetherby
- Timing discrepancy: scheduled 12:48 versus recorded off 12:49; use stable race identity and actual off timestamp in future prospective snapshots.

## Wetherby 14:30, Class 3 handicap chase, 2m3f85y, good
- Five runners; **Palamon**, 7/4 joint-favourite, won by 8½ lengths over **The Bluesman**, also 7/4 joint-favourite. Palamon was ridden by Dominic Lewis, claiming 10lb, for Dan Skelton. The Bluesman was ridden by T Walsh, also claiming 10lb, for Olly Murphy. Comparing the two requires their declared and effective weights, not rider reputation alone.
- Race result comments describe Palamon pressing the lead from the tenth fence and moving clear after two out; The Bluesman was held up and made late headway. Neither establishes a multi-run pace style.
- Sources: https://www.sportinglife.com/racing/results/2026-11-14/wetherby/948529/boyle-sports-handicap-chase-gbb-race ; https://www.horseracing.net/results/wetherby/14-11-26

## Cheltenham 14:20, Class 1 Paddy Power Gold Cup, 2m4f44y, good
- Ten starters; **Meetmebythesea** won at 2/1 favourite, OR 151 and 11st10lb, with Harry Cobden for Ben Pauling; **Blueking d'Oroux** second by 2½ lengths at 10/3.
- Result comments report the winner pecking on landing at the last and subsequently staying on; the runner-up made a mistake at the last. This supports race-specific jumping-execution context, **not** a retrospective claim of pre-race superiority.
- Racing Post labels this 16 fences on Cheltenham Old Course; other result feed describes good-to-firm in places. Retain each source's going wording and reconcile exact race-time official going before matched-condition comparisons.
- Sources: https://www.racingpost.com/results/11/cheltenham/2026-11-14/930632/ ; https://www.oddschecker.com/horse-racing/results/2026-11-14/cheltenham/14%3A20 ; https://www.horseracing.net/results/cheltenham/14-11-26

## Shadow research decisions
1. Require separate `scheduled_time`, `actual_off_time`, `observed_at`, `source_url`, `race_id`, and `source_rights_status` for each reviewed race. Never treat post-off observation time as a pre-off source capture.
2. For claiming jockeys, keep card weight, claim pounds, actual effective weight, and BHA achieved-performance adjustment separate. Never award a booking bonus without market-conditional holdout evidence.
3. Distinguish single-run position notes from a pace-style grade (minimum two independent historical observations under v4).
4. Do not conflate Racing Post RPR with official BHA performance figures. No verified BHA achieved-performance figures or sectional-par observations captured in this run.
5. Flag going-source disagreement and scheduled/actual off differences for reconciliation. No invented stewards' findings.

## Coverage delta and gate
- New dated race-level retrospective review references: **3** (pending cross-run race-ID deduplication).
- New complete, permission-cleared historical runner rows: **0**.
- New prospective frozen cards with as-at market baseline: **0**.
- New verified horse-specific last-three prior-run records: **0**.
- New measured Challenger C uplift: **none**.
- All races remain **research incomplete** for v4 full-field grading: individual profiles, last three own runs, older relevant form, ratings, equipment, trainer records with denominators, and race-time sources not fully collected.

Next experiment: resolve IDs and source rights, then one complete race with each horse's last three individually sourced pre-race results; build market-conditional jockey-booking flags with chronological splits and shrinkage. Do not change frozen A/B1, live tips or the paper ledger.
