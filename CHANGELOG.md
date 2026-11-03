# Changelog

All notable changes to ChessForge are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Enforcement Policy:** `CHANGELOG.md` is updated after every functional edit, pull request, and phase milestone to reflect current status, completed changes, and future requirements. Phases are strictly locked sequentially.

---

## [Unreleased]

### Current Status
- **Active Phase:** Phase 1 (Foundation & Application Shell)
- **Gate Status:** Complete. All Phase 1 deliverables, unit tests, e2e smoke tests, CI workflow, and documentation have passed. Ready for v0.1.0 tag cut.

### Added
- **Playwright E2E Smoke Test** `tests/e2e/smoke.spec.ts` & `playwright.config.ts`:
  - Verifies application shell, titlebar, and workspace headers.
  - Tests AuthModal flow: opens modal, toggles Sign In / Create Account, validates headings, closes modal.
  - Tests Navigation to Analysis workspace.
  - Tests board rendering via Chessground (`cg-board`), move position label, board flipping (orientation change), and disabled state of undo when at root.
  - Added `"test:e2e": "playwright test"` npm script and updated `.github/workflows/ci.yml` to run E2E smoke tests on push/PR.
- **Undo move** in Analysis workspace (`src/App.tsx`):
  - `undoMove()` trims the last SAN from the `moves[]` array and snaps `historyIndex` to the new end of the line.
  - **Keyboard shortcut `Ctrl+Z` / `Cmd+Z`** wired via `useEffect` — does not fire when focus is inside an `<input>` or `<textarea>`.
  - **Arrow key navigation** via the same `useEffect`: `←` = previous move, `→` = next move.
  - Undo button rendered in board controls bar; disabled/dimmed when there are no moves to undo.
- **`src/lib/AuthContext.tsx`** — React context provider (`AuthProvider`) that owns a single global `onAuthStateChange` listener. All components that call `useAuth()` share one session, one user object, and one profile — no duplicated listeners or stale state after sign-in / sign-out.
- **`src/main.tsx`** — wrapped `<App />` in `<AuthProvider>` so the context is available throughout the tree.
- **`src/lib/auth.ts`** — simplified to a re-export barrel (`useAuth`, `AuthProvider`, `OAUTH_CALLBACK_URL`, `AuthState`) for backward-compatible imports.

### Fixed
- **UI not reflecting logged-in state after sign-in** — root cause: `App.tsx` and `AuthModal.tsx` each called `useAuth()`, creating two independent hook instances with separate React state. When `signInWithPassword` resolved and `onAuthStateChange` fired, the `App` instance could miss or lag the update. Fixed by lifting all auth state into a single `AuthContext` — one listener, one source of truth, all subscribers update atomically.

### Added
- **CI pipeline** `.github/workflows/ci.yml` — runs TypeScript typecheck and Vitest unit tests on every push and pull request to `main`. Uses Node 22, `npm ci`, and concurrency cancellation for stale runs.
- **AuthModal full rewrite** `src/components/AuthModal.tsx`:
  - Primary form: email + password sign-in and sign-up (toggle between modes inline).
  - Secondary option: "Continue with Google" OAuth button (uses Supabase `signInWithOAuth` with `redirectTo` callback URL).
  - Show/hide password toggle.
  - Inline mode switch (sign-in ↔ create account) without closing the modal.
  - Error state display; loading spinner on submit.
  - Graceful unconfigured-Supabase fallback (no crash if env vars missing).
- **Chess move state architecture fix** `src/App.tsx`:
  - Replaced `game: Chess` state (FEN snapshot) with `moves: string[]` state (ordered list of SAN strings).
  - `game` is now a derived `useMemo` that replays all SAN moves on a fresh `Chess()` from the starting position — no move-history loss.
  - `displayGame` is derived from `history.slice(0, historyIndex)` using `m.san` strings (not verbose move objects), eliminating the `before`/`after` FEN mismatch crash.
  - `makeMove` validates against the current display position, then appends the resulting SAN to the `moves` array and truncates any future branch — correct branching behaviour.
- Added `Lock`, `Eye`, `EyeOff` imports to `AuthModal`; removed unused `Mail` (kept), `CheckCircle` (removed) dependencies.
- **Interactive `BoardView`** component in `src/components/BoardView.tsx` wrapping `chessground` with `chess.js` legal move enforcement, drag/drop, and pawn promotion modal. (Previously added.)
- **`useAuth` hook** `src/lib/auth.ts` — all four auth methods: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle` (OAuth), `signInWithEmail` (magic link). Callback URL: `https://rjxpuxmwdcqgierciqpg.supabase.co/auth/v1/callback`.
- Authentication status integrated into titlebar and sidebar (initials avatar, sign-in/sign-out).
- ADRs `0001`–`0007` in `docs/decisions/` covering technology choices, RLS, evaluation storage, engine worker, package boundaries, PGN strategy, and licensing.
- Supabase migration `supabase/migrations/20261103000000_create_profiles.sql` — `profiles` table, signup trigger, RLS policies.
- Supabase client helper `src/lib/supabase.ts`.
- License registry `docs/licences.md`.
- Unit test suites: `tests/unit/chess-rules.test.ts` (6 tests), `tests/unit/supabase.test.ts` (2 tests) — all 8 pass.

### Fixed
- **Analysis page crash on Black's first move** — root cause: `makeMove` was creating `new Chess(fen)` (losing history), then `displayGame` replayed verbose move objects (with `before`/`after` FEN fields) against a fresh `Chess()`, causing FEN mismatch. Fixed by switching to SAN-array state and SAN-based replay.
- **Auth modal used magic link only** — fully rewritten to email+password primary flow with Google OAuth as alternative.
- Fixed TypeScript compiler error (`TS2305: 'ChessKnight'` missing from lucide-react) — replaced with inline SVG component.
- Resolved Electron binary initialization failure — post-install download and `allowScripts` configured.

---

## Future Requirements by Phase

### Phase 1: Foundation (Target: v0.1.0)
- [x] Connect Supabase backend with initial `profiles` migration and Row Level Security (RLS) policies.
- [x] Implement user authentication — email+password primary, Google OAuth as alternative.
- [x] Integrate Chessground board component backed by `chess.js` for legal move handling.
- [x] Setup Vitest unit test suite (8 tests passing).
- [x] Initialize `docs/licences.md` and ADRs `0001`–`0007`.
- [x] CI pipeline (`.github/workflows/ci.yml`) — typecheck, unit tests, and Playwright e2e smoke tests on push/PR.
- [x] Playwright end-to-end smoke test (`tests/e2e/smoke.spec.ts`).
- [ ] Tag `v0.1.0` once phase sign-off confirmed.

### Phase 2: Import & Library (Target: v0.2.0)
- [ ] Implement pure TypeScript PGN parser with fixture test suite in `packages/chess-core`.
- [ ] Implement SHA-256 game fingerprint deduplication.
- [ ] Add `games` and `platform_accounts` Supabase tables with RLS and user ownership.
- [ ] Build drag-and-drop file upload, PGN text paste dialog, and malformed game reporting.
- [ ] Build game library view with platform, color, result, and time control filters.

### Phase 3: Engine Analysis (Target: v0.3.0)
- [ ] Implement `Engine` interface and UCI parser in `packages/engine`.
- [ ] Integrate Stockfish WASM running in a dedicated Web Worker with cancellation support.
- [ ] Create `game_analyses` and `positions` tables with RLS.
- [ ] Normalize centipawn and mate evaluations to White-relative values.
- [ ] Build evaluation graph and interactive move navigation.

### Phase 4: Mistakes, Exercises & Spaced Repetition (Target: v1.0.0 - "The Loop")
- [ ] Implement win-probability move classification (Best, Good, Inaccuracy, Mistake, Blunder, Missed Opportunity).
- [ ] Build exercise generator adhering to strict eligibility rules (max 3/game, unambiguous moves, non-decided positions).
- [ ] Create `training_exercises`, `exercise_attempts`, and `review_schedule` tables with RLS.
- [ ] Build interactive solving desk with hint support and "Bad exercise" feedback button.
- [ ] Implement modified SM-2 spaced repetition scheduler with daily queue caps.
- [ ] Implement JSON and PGN full data export.

### Phase 5: Insight & Weakness Diagnosis (Target: v1.1.0)
- [ ] Implement heuristic tactical weakness tagging (hanging piece, missed mate, missed fork, back-rank).
- [ ] Add time-pressure mistake tagging using PGN clock annotations.
- [ ] Build trend visualisations with explicit sample size labeling (minimum N >= 20).

### Phase 6: Platform Integrations (Target: v1.2.0)
- [ ] Server-side Chess.com archive sync via Edge Functions with ETag caching.
- [ ] Server-side Lichess game streaming adapter with rate-limit backoff.
- [ ] Resumable import checkpoints and logging.

### Phases 7–10: Advanced Capabilities
- [ ] Phase 7: Opening repertoires and deviation drilling (`v1.3.0`).
- [ ] Phase 8: Technical endgame trainer and calculation lab (`v1.4.0`).
- [ ] Phase 9: Desktop packaging and hardening (`v2.0.0`).
- [ ] Phase 10: Multi-user onboarding and public readiness.

---

## [0.0.0] - 2026-11-03
### Added
- Project charter, Electron desktop foundation, and initial v1.0 specification set.

