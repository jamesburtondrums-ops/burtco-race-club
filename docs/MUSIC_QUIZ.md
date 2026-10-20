# BURTCO Music Quiz

This repo includes the standalone host-only BURTCO Music Quiz at [public/music-quiz/index.html](../public/music-quiz/index.html).

## Live URL

https://burtco-music-quiz.james-burton-drums.workers.dev/

The quiz is published as a **separate Cloudflare Worker** (worker name `burtco-music-quiz`). This keeps Race Club unaffected. The worker currently serves a bundled copy of this HTML file.

> Important: Updating this GitHub file alone does **not** update the Cloudflare Worker. Redeploy the changed HTML to the `burtco-music-quiz` Worker to publish changes.

## Features

- Host-controlled 2-hour music quiz, with a separate on-screen audience window
- Twenty five-second song intros, 20 music-knowledge questions, 10 artist and 10 year questions
- Printable team sheets and answer key
- Music Library with local browser persistence and optional private Supabase cloud storage

## Media and security

- Upload your own appropriately licensed tracks in the quiz's back office. Do **not** commit MP3s or private music to this repository.
- Cloud music files are stored in the private `burtco-music-library` storage bucket with authenticated per-user rules.
- The quiz webpage and its built-in answers are public and are **not** restricted to a signed-in host. Do not share the host URL with competing teams. For stronger quiz secrecy, deploy a protected host page before running a public event.
- The browser-visible Supabase publishable key is intentionally not a secret. Never include service-role keys or other private credentials in this repository.
