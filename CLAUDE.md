# ChessForge: Instructions for AI Assistants

## What This Is
A chess training app: import games, analyse with Stockfish, find recurring
mistakes, generate personal exercises, schedule them with spaced repetition.
Full documentation resides in `docs/` and `ChessForge Documentation Set.md`.
Read `docs/ROADMAP.md` to see the current phase before starting.

## Current Phase
Phase 1: Foundation.
**Strict Rule:** Do NOT move to any subsequent phase before the current phase meets all exit criteria and is signed off.

## Changelog Policy
After EVERY edit or task completion, update `CHANGELOG.md` under `[Unreleased]` with current status, changes, and future requirements.

## Stack
React + TypeScript (strict), Vite, Tailwind, TanStack Query, Zustand,
chess.js, Chessground, Stockfish WASM in a Web Worker, Supabase
(Postgres, Auth, Edge Functions), Vitest, Playwright.

## Commands
npm install         install dependencies
npm run dev         run the development environment (Vite + Electron)
npm run build       build renderer and electron bundles
npm start           run electron from dist build
npm test            run tests

## Architecture Rules (Do Not Break)
- packages/chess-core, analysis, training are pure TypeScript. No React,
  no browser APIs, no Supabase client, no network.
- Only packages/engine touches Web Workers or native engine processes.
- Only apps/web calls Supabase.
- All evaluations are stored White-relative. Never store side-to-move scores.
- Move classification uses win-percentage loss, thresholds from shared/config.
  Never hard-code centipawn thresholds.
- Every user-owned table has user_id and RLS enabled in the SAME migration.
- Original PGN is stored unchanged. Never edit it.
- Engine name, version and settings are stored with every analysis.
- Incomplete engine results are never classified or turned into exercises.

## Security Rules
- Never put the service-role key or any secret in frontend code, logs, or git.
- Treat all PGN text (names, events, comments) as untrusted. Render as text only.
- Validate every external input (PGN, FEN, request bodies) before use.
- No engine assistance in live games. Completed games only.

## Working Style
- Write a short plan before coding anything larger than a small fix.
- Write or update tests first for domain logic (chess-core, analysis, training).
- Update CHANGELOG.md after every edit.
- Keep changes focused on one concern at a time.

