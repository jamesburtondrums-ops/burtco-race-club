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


## Near-live race results (Cloudflare Pages)

The frontend requests `/api/live-results` every 15 seconds while the tab is visible.
The Cloudflare Pages Function caches authorised API responses for 30 seconds,
then returns **only the runners selected on this site** with their finishing
positions, starting prices (if the API tier supplies SP), and field sizes.
A connected live result immediately updates the visible paper-bet tracker.
The permanent JSON ledger is synchronised by the five-minute GitHub workflow
using the same Pages endpoint if GitHub does not have separate API credentials.

**Activation (required):**
1. Register/subscribe at The Racing API: https://www.theracingapi.com/
2. In Cloudflare: Workers & Pages -> racing-intelligence -> Settings -> Variables and Secrets.
3. Add production **secret** variables `RACING_API_USERNAME` and
   `RACING_API_PASSWORD` from The Racing API account (not the website login).
4. Redeploy the production branch `racing-intelligence`.
5. Visit `https://racing-intelligence.pages.dev/api/live-results` and check
   for `"connected":true`; a `"connected":false` response includes a reason.

No secret is embedded in client JavaScript or committed to GitHub.
Free-tier results provide places/finishes; SP or live market odds need a tier
that includes them. The Racing API source data currently updates every five
minutes, and GitHub scheduled workflows can be delayed. The site checks more
frequently to display new results as soon as they become available.
Sporting Life is a manual verification link only; scraping is not enabled.
