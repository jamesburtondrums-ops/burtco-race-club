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

## Production next step

Connect licensed racecard + pedigree data, sectional/tracking data, and a live odds/exchange feed. Then calculate model fair odds and value gaps from calibrated historical models instead of demo labels.
