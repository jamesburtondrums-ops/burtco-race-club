# Racing Intelligence — GB + Ireland full-card engine

This site is isolated on the `racing-intelligence` branch. The Race Club production branch is untouched.

## Live coverage architecture
The ingestion adapter is built around The Racing API because its documented Core API covers UK and Irish pre/post-race data and refreshes every few minutes.

Every daily ingest requests GB + IRE cards and stores each runner's:
- official rating (OR)
- provider Performance Rating (PR)
- provider Speed Rating (SR; Flat only where published)
- weight, draw, form, jockey, trainer
- sire / dam / damsire fields where supplied
- bookmaker odds available in the racecard response
- up to four years of horse race history via the racecard horse-results endpoint
- derived last winning OR / best winning OR
- pounds below last winning OR
- course starts/wins and C&D places
- class-drop and hidden-run text flags
- transparent evidence matrix and signal grade

## Automatic refresh
GitHub Actions runs:
- 05:15 UTC full daily ingest
- every 15 minutes from 07:00–22:59 UTC

The updater validates the response. If authentication, provider or validation fails, the last good dataset is preserved.

## Required GitHub secrets
To activate live data:
- `RACING_API_USERNAME`
- `RACING_API_PASSWORD`

Optional repository variable:
- `RACING_API_PLAN` = `free`, `standard`, or `pro` (default `standard`)

Without credentials, the deployed site intentionally remains on the verified fallback snapshot.

## Official validation
BHA and IHRB remain official handicap-rating references. The interface keeps provider PR/SR distinct from official OR.

## Next market layers
- Betfair Exchange adapter: back/lay, traded volume and liquidity-aware market moves
- TPD adapter: sectionals, position, excess ground and pace upgrades

Racing Post and ATR are not used as brittle/restricted production scrapers.
