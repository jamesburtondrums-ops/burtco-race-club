# Racing Intelligence
Standalone prototype on the racing-intelligence branch. Main Race Club code is untouched.

Includes today's verified demo snapshot, evidence-led market signals, race drilldowns, horse tracker, source health, and a scheduled refresh workflow.

Production feeds should be licensed/approved. The app intentionally does not scrape Racing Post or ATR as its production dependency. Configure RACING_FEED_URL and optionally RACING_FEED_TOKEN as repository secrets when a permitted feed is available.