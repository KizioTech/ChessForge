# ChessForge: Instructions for AI Assistants

## What This Is
A chess training app: import games, analyse with Stockfish, find recurring
mistakes, generate personal exercises, schedule them with spaced repetition.
Full documentation resides in `docs/` and `ChessForge Documentation Set.md`.
Read `docs/ROADMAP.md` to see the roadmap and milestones.

## Current Phase
Phase 7: Opening Repertoires (next phase — Phase 6 complete).
- Phase 1 (Foundation): Complete & signed off.
- Phase 2 (Data Ingestion & Integrity): Complete & signed off.
- Phase 3 (Analysis Pipeline): Complete & signed off.
- Phase 4 (Continuous Training Loop): Complete & signed off at `v1.0.0`.
- Phase 5 (Insight & Weakness Diagnosis): Complete & signed off at `v0.5.0`.
- Phase 6 (Platform Integrations): Complete & signed off at `v0.6.0` — Chess.com PubAPI + Lichess stream sync, live ELO display, rate limiting, deduplication, `import_logs` checkpoints.
- Phase 7 (Next): Opening repertoire trees, practice drilling, game deviation alerts — `v0.7.0`.

## Changelog Policy
After completing each distinct functional change or milestone, record a concise single-line entry under `[Unreleased]` in `CHANGELOG.md`. Avoid redundant multi-paragraph status recaps.

## Stack
React + TypeScript (strict), Vite, Tailwind/CSS variables,
chess.js, Stockfish 19 Lite WASM in a dedicated Web Worker, Supabase
(Postgres, Auth, Storage, Edge Functions), Vitest, Playwright, Electron desktop runtime.

## Commands
npm install         install dependencies
npm run dev         run the development environment (Vite + Electron)
npm run build       build renderer and electron bundles
npm start           run electron from dist build
npm run dist:app    build installer (output: release/) — Windows NSIS, macOS DMG, Linux AppImage
npm test            run unit tests
npm run test:e2e    run Playwright smoke tests

## Architecture Rules (Do Not Break)
- Domain libraries in `src/lib/chess/`, `src/lib/engine/` (pure logic), and `src/lib/training/` are pure TypeScript: no React, no browser UI, no direct DOM manipulations.
- Web Worker and engine process orchestration is isolated in `src/lib/engine/stockfish-engine.ts`.
- Never silently fake engine results in production; throw on worker or timeout errors. For tests only, use `HeuristicEngine`.
- Remote persistence is routed through `src/lib/supabase.ts`, with LocalStorage caching for offline resilience.
- All evaluations are stored White-relative (ADR 0003). Never store side-to-move scores.
- Move classification uses win-percentage loss (ADR 0003).
- Every user-owned table has `user_id` and RLS enabled in the same migration that creates it.
- Original PGN is stored unchanged. Never edit it.
- Engine provenance (name, version, depth, multipv) is stored with every analysis. Stockfish 19 Lite WASM is labelled `19-lite-wasm`.
- Opponent mistakes are never included in the user's mistake database or exercise queue.
- Incomplete engine results are never classified or turned into exercises.

## Security Rules
- Never put the service-role key or any secret in frontend code, logs, or git.
- Treat all PGN text (names, events, comments) as untrusted. Render as text only.
- Validate every external input (PGN, FEN, request bodies) before use.
- Content Security Policy (CSP) is strictly enforced in `index.html`.
- No engine assistance in live games. Completed games only.
