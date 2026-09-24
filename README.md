# BURTCO Race Club

Prototype charity race-night web app.

## Views
- `/?host=1` — host/controller
- `/` — projector/main screen
- `/?play=1` — mobile player app

## Current prototype
Persistent player ID, lobby, race cards, virtual bets, host-controlled lock/start/result, automatic settlement and profit leaderboard. Player identity survives phone lock, refresh and temporary disconnect via local storage.

## Next production step
Replace browser-local prototype state with a server-authoritative realtime database/WebSocket service so separate devices share state reliably. Add supplied race footage and bind each video to runner count/result.

## Run
`npm install && npm run dev`
