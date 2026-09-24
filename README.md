# BURTCO Race Club

Realtime charity race-night web app.

## Views
- `/?host=1&session=DEMO01` host/controller
- `/?session=DEMO01` projector
- `/?play=1&session=DEMO01` mobile player

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL editor.
3. Copy `.env.example` to `.env` and add the project URL and anon key.
4. `npm install && npm run dev`

Player identity is a persistent random device token in localStorage; race state, bets, profit and leaderboard live in the database. Phone sleep/network loss therefore does not remove the player. Realtime subscriptions plus a fallback refresh keep devices synchronized.

## Footage
Race video support is the next media layer. Each supplied video will be mapped to race number, runner count and known winner.
