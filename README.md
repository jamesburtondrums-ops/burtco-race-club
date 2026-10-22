# FormSignal — Racing Intelligence

Standalone racing research prototype built on the `racing-intelligence` branch. The existing Race Night app on `main` is untouched.

## What is implemented

- Today's meeting/race dashboard
- Market Intelligence signal cards
- Transparent evidence scorecards
- Verified Fact vs Model View separation
- Course/distance, handicap, progression, pedigree and race-fit signals
- Race drill-downs
- Tracker
- Source/freshness screen
- Feed-ready data adapter
- Scheduled GitHub Actions refresh workflow
- Graceful fallback: no feed = no invented values

## Automatic refresh

The workflow `.github/workflows/racing-refresh.yml` runs a morning refresh and hourly daytime refreshes.

It expects:
- `RACING_DATA_API_URL` — an approved/licensed endpoint returning normalized JSON
- `RACING_DATA_API_TOKEN` — optional bearer token

If no feed is configured, the job leaves the verified demo dataset untouched.

The adapter intentionally does **not** scrape Racing Post or ATR. They remain cross-check references unless automated use is explicitly permitted.

## Normalized feed contract

At minimum, the endpoint must return:

```json
{
  "meta": {
    "snapshot": "7 Oct 2026",
    "market_connected": false
  },
  "meetings": []
}
```

It may also replace `signals`, `deep_races`, `tracker`, and `sources`.


## Whole-programme race day research (22 October 2026)

A historical **40-race / 397-active-runner / 31 reported-NR** card snapshot is published at [whole-day screening](https://racing-intelligence.pages.dev/all-races-2026-10-22.html), with five raw meeting files and manifest in `data/research/`.

**All-race form screening is different from full horse-history investigation.** The 40-race snapshot includes reported runner identities, abbreviated form, declared trainer/jockey and withdrawals across Carlisle, Clonmel, Ffos Las, Newmarket, and Southwell. Only six chosen race fields have 66 runner profiles with 3+ dated past-run observations; two later Southwell fields were separately assessed at individual racecard-form level. Neither tier supplies comprehensive measured sectionals, statistically validated course/trainer partnership estimates, a held-out win-probability model, or guaranteed bookmaker EW terms.

- Verify source universe: `node scripts/validate-daywide-coverage.mjs data/research/2026-10-22-all-races-manifest.json`
- Inspect all race/horse form flags: `node scripts/screen-whole-raceday.mjs 14:29`
- Run assertions: `node --test tests/racing-whole-day-screen.test.mjs`
- Deep six-race coverage validator: `node scripts/validate-racing-deep-audit.mjs`
- Published research: [clear selections](https://racing-intelligence.pages.dev/selections-2026-10-22.html), [66-runner dossier](https://racing-intelligence.pages.dev/full-field-2026-10-22.html).

**Future dates:** The repository **does not automatically obtain 397 historical runner profiles or even complete live racecard universes** without a permitted, reliable feed. Prepare a date-specific meeting manifest from approved source(s), reconcile every meeting/race/NR, capture chronological individual history, then decide bets with independent field-relative modelling and separately verified prices. Do not silently reuse the 22 October snapshot as a new day's current state.

The prospectively added Filly Eilish and Blue Orbit research selections retain separate 14:41 BST review timestamps. The original four research picks, frozen `data/races.json` original selections, past results and cleared paper-bet ledger have not been changed by this work. No accepted or paper wagers are recorded.

## Production next step

Connect licensed racecard + pedigree data, sectional/tracking data, and a live odds/exchange feed. Then calculate model fair odds and value gaps from calibrated historical models instead of demo labels.
