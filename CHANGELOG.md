# Changelog

All notable changes to ChessForge are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Enforcement Policy:** `CHANGELOG.md` is updated after every functional edit, pull request, and phase milestone to reflect current status, completed changes, and future requirements. Phases are strictly locked sequentially.

---

## [Unreleased]

### Current Status
- **Active Phase:** Phase 5 (Insight & Weakness Diagnosis)
- **Gate Status:** Phase 4 completed and signed off at `v1.0.0` (Release 1 - The Loop Complete).

### Fixed & Hardened
- **Engine Integrity & Error Handling**: Removed silent fallback fakes from `StockfishEngine`; initialization and timeouts now throw/reject to guarantee analysis veracity. Isolated test mock into `HeuristicEngine`.
- **Exercise Generation Accuracy**: Solution scoring now calls `calculateWinProbability` (supporting mate evaluations accurately) and enforces the 10-point single-solution cutoff.
- **Mistake Isolation**: Filtered out opponent mistakes to prevent stats and training queue pollution.
- **FEN-Based Move Classification**: Side to move is now derived directly from FEN in `computeMoveClassifications`, supporting arbitrary starting positions.
- **Engine Provenance**: Re-labelled engine version from `16-wasm` to `19-lite-wasm` (`Stockfish 19 Lite`).
- **Security & Desktop Shell**: Added strict Content Security Policy (CSP) and favicon in `index.html`, added desktop app logo branding, and enabled `--allow-file-access-from-files` for packaged Electron worker execution.
- **Documentation & Architecture Alignment**: Updated `CLAUDE.md`, `README.md`, and added ADR 0011 (Electron Desktop Runtime).

---

## [1.0.0] - 2026-11-03

### Release 1: The Loop Complete
Completes the core continuous training loop: game import -> Stockfish WASM analysis -> automated mistake detection -> exercise generation with eligibility rules -> modified SM-2 spaced repetition review queue -> interactive solving desk -> data sovereignty export.

### Added
- **Database Migration 000004 (`supabase/migrations/20261103000004_create_training_and_exercises.sql`)**:
  - `mistakes` table with engine classification, win percentage loss, best moves, and RLS.
  - `training_exercises` table with unique constraint on `(user_id, fen)`, solutions jsonb, blunder moves, and difficulty.
  - `review_schedule` table with SM-2 state: `interval_days`, `ease_factor`, `repetitions`, `lapses`, `due_at`.
  - `exercise_attempts` table capturing user solving attempts, duration, hints used, and SM-2 grades.
  - `training_sessions` table tracking user study sessions.
  - Pushed to remote Supabase project `rjxpuxmwdcqgierciqpg`.
- **Modified SM-2 Spaced Repetition Engine (`src/lib/training/sm2.ts`)**:
  - Full implementation of Section 3.8: initial ease factor 2.50, minimum ease factor 1.30.
  - Grade transitions: `Again` (10-minute reset, lapse penalty), `Hard` (1.2x interval scaling, ease penalty), `Good` (1d -> 3d -> interval * ease), `Easy` (1.3x boost, ease boost).
  - Interval ceiling at 60 days.
  - Automatic mastery classification when 5 consecutive Good or Easy grades are achieved.
  - Grade inference engine (`inferGrade`) estimating performance from duration and hint usage.
- **Automated Exercise Eligibility Generator (`src/lib/training/exercise-generator.ts`)**:
  - Section 3.7 eligibility filtering:
    1. Player color match: only user mistakes and blunders become exercises.
    2. Decided position filter: restricts positions to 10%–90% win probability before move.
    3. Task clarity: verifies best move beats second-best by >= 8% win probability or captures acceptable multi-solution candidate sets.
    4. Capped at 3 exercises per game, prioritized by largest win-probability loss.
    5. Automatic FEN deduplication.
  - Automatic exercise classification into `Attack` (tactical punch), `Defence` (resilient hold), and `Avoid the blunder` (avoid the game mistake).
- **Dual-Layer Training Persistence (`src/lib/training/training-service.ts`)**:
  - Mirrored storage: remote Supabase upserts for authenticated sessions + LocalStorage offline sync.
  - Functions: `saveGeneratedExercises`, `getDueExercises`, `recordAttemptAndAdvanceSchedule`, `flagExercise`, `getTrainingStats`.
  - Metric computation: real-time due count, active count, mastered count, streak days, and blunders per 100 moves.
- **Interactive Training Solving Desk (`src/components/TrainingDesk.tsx`)**:
  - Interactive chessboard solving environment reusing `BoardView`.
  - Dynamic objective prompt and exercise type chips.
  - Real-game blunder comparison: alerts player if they replay their original blunder.
  - 2-tier hint assistance (1: piece indicator, 2: destination square).
  - Solution reveal option.
  - "Bad exercise" flagging modal with categorization reasons to retire noisy positions.
  - SM-2 performance rating selector with auto-inferred recommendations.
  - Session progress tracker and celebratory completion summary.
- **Review Queue Browser (`src/components/ReviewQueue.tsx`)**:
  - Spaced repetition queue manager showing due exercises, active library, and mastered positions.
  - Due status indicators, repetition counts, and interval lengths.
  - One-click "Start training" CTA.
- **User Data Sovereignty & Export (FR-112, `src/lib/export.ts`)**:
  - `exportGamesToPgn()`: exports all library games into multi-game PGN format.
  - `exportAllDataAsJson()`: comprehensive client backup containing games, mistakes, exercises, review schedules, and attempt histories.
  - Download trigger in toolbar for instant offline archiving.
- **ADR 0010 (`docs/decisions/0010-spaced-repetition-and-exercise-eligibility.md`)**:
  - Documented SM-2 design, Section 3.7 eligibility rules, and data sovereignty policies.
- **Unit & E2E Test Suite Expansion**:
  - 13 unit tests for SM-2, exercise generator, and exports (`tests/unit/training.test.ts`) — total 43 unit tests passing.
  - E2E smoke test covering Review Queue navigation, Training Desk, and PGN export — total 4 E2E tests passing.

---

## [0.3.0] - 2026-11-03

### Added (Phase 3 — unreleased)
- **Stockfish 19 WASM Engine Integration**:
  - Installed `stockfish` npm package (v19); copied `stockfish-19-lite-single.js` + `stockfish-19-lite-single.wasm` (1.8 MB) to `public/` for Vite static serving.
  - `StockfishEngine` class (`src/lib/engine/stockfish-engine.ts`) implementing `Engine` interface with Web Worker isolation, UCI command loop, MultiPV parsing, and fallback inline heuristic engine for Node/Vitest environments.
- **UCI Parser** (`src/lib/engine/uci-parser.ts`):
  - `parseUciInfoLine()` parsing `info depth … score cp … pv …` lines; inverts scores when Black is to move to produce consistent White-relative evaluations (ADR 0004).
  - `uciToSan()` converting UCI moves to SAN via `chess.js`.
  - `buildPositionEvaluation()` assembling `PositionEvaluation` with MultiPV candidate lines.
- **Win Probability Module** (`src/lib/engine/win-probability.ts`, ADR 0003):
  - `calculateWinProbability(scoreCp, mateIn)` → 0..100% using sigmoid formula.
  - `getMoverWinProbability()` flipping perspective for Black.
  - `classifyMove(loss, isBestMove)` producing "best" | "good" | "inaccuracy" | "mistake" | "blunder" thresholds.
- **Game Analyzer Pipeline** (`src/lib/engine/game-analyzer.ts`):
  - `analyzeGame(game, options)` sequencing through all plies, reporting progress 0–100%, honoring `AbortSignal`.
  - `computeMoveClassifications(positions)` building `MoveAnalysisReport[]` with win-prob loss per ply.
- **Analysis Persistence** (`src/lib/analyses.ts`):
  - `saveAnalysis()` with dual-layer strategy: Supabase upsert (real UUIDs only) + LocalStorage fallback (all sessions).
  - `getAnalysisForGame()` checking Supabase first, then LocalStorage.
  - UUID guard prevents test fixtures from triggering Supabase 400 errors.
- **Database Migrations** (`supabase/migrations/20261103000003_create_game_analyses_and_positions.sql`):
  - `game_analyses` table: `id`, `game_id`, `user_id`, `engine_name`, `depth`, `multipv`, `status`, progress fields, timestamps.
  - `positions` table: `ply`, `fen`, `move_san`, `move_uci`, `score_cp`, `mate_in`, `win_probability`, `best_move_uci/san`, `pv_lines` (jsonb), full RLS.
  - Applied to Supabase project `rjxpuxmwdcqgierciqpg`.
- **Evaluation Graph Component** (`src/components/EvalGraph.tsx`):
  - SVG-based win-probability sparkline across all plies (0–100%).
  - Clickable — clicking a point jumps `historyIndex` to that ply.
  - Blunder (red) and mistake (yellow) dot markers.
  - Active ply vertical cursor with live score readout.
  - Shown below board controls once analysis is complete.
- **Live Engine UI in Analysis Workspace** (`src/App.tsx`):
  - `handleAnalyzeGame()` state machine: creates `AbortController`, calls `analyzeGame()`, streams progress, sets `analysisPositions` + `moveReports` on completion.
  - "Analyse game" button enables when a game is loaded; shows live "Cancel (X%)" during analysis; switches to "Re-analyse" after completion.
  - Live progress bar (`.analysis-progress-track`) below heading during analysis.
  - Engine evaluation panel shows live `score_cp`, `mate_in`, MultiPV candidate lines from `currentEval.pv_lines`.
  - Engine badge shows "SF16" (live, pulsing) when analysis is available, "Offline" otherwise.
- **Move Classification Badges** in notation panel:
  - `??` (blunder, red), `?` (mistake, yellow), `?!` (inaccuracy, blue) rendered inline after each move SAN.
- **Checkmate & Check Banners** in board panel:
  - `.analysis-checkmate-banner` with slide-in animation rendered when `displayGame.isCheckmate()`.
  - `.analysis-check-banner` for in-check positions.
  - Both are distinct from `BoardView`'s own `board-game-over-banner` overlay.
- **Phase 3 CSS** (`src/styles-phase3.css`):
  - Progress bar, cancel button, pulsing live badge, candidate lines, rank/score cells, classification badges, checkmate/check banners.
- **ADR 0009** (`docs/decisions/0009-analysis-pipeline-and-caching.md`):
  - Dual-layer persistence, UUID guard, sequential ply evaluation, WASM delivery rationale.
- **Engine Type System** (`src/lib/engine/types.ts`):
  - `EngineConfig`, `CandidateLine`, `PositionEvaluation`, `MoveAnalysisReport`, `GameAnalysisRecord`, `PositionRecord`, `AnalysisStatus`, `MoveClassification`, `Engine` interface.
- **30 Unit Tests Passing** (`tests/unit/engine.test.ts`):
  - Win probability formula, mover perspective, move classification thresholds.
  - UCI parser White/Black normalization, mate inversion, SAN conversion.
  - `buildPositionEvaluation` with MultiPV.
  - `analyzeGame` ply-by-ply Scholar's Mate (8 plies), progress reporting, abort.
  - `computeMoveClassifications` blunder detection.
- **E2E Test Suite** (`tests/e2e/smoke.spec.ts`) — 3 tests:
  - Test 1: App shell navigation, auth modal, board verification (Chessground `.board-container`), flip board, undo disabled.
  - Test 2: Full import → My Games → Analysis round-trip, metadata, checkmate status, duplicate detection.
  - Test 3: Engine UI elements — "Analyse game" button disabled without game, enabled with game, eval graph hidden before analysis, notation populated.

---

## [0.2.0] - 2026-11-03

### Added
- **Independent Sidebar Component (`src/components/Sidebar.tsx`)**:
  - Extracted navigation and profile switcher from `App.tsx` into a modular, self-contained `<Sidebar />` component.
  - Implemented independent scrolling container (`height: 100%`, `overflow-y: auto`, slim scrollbar) isolating sidebar navigation from main content scroll events.
- **Fixed Viewport Header Layout (`src/styles.css`)**:
  - Fixed application titlebar header (`height: 40px`, `position: sticky`, `z-index: 50`) at the top of the viewport.
  - Bounded `.app-body` to `calc(100vh - 40px)` with `overflow: hidden`, isolating `.main-area` (`overflow-y: auto`) and `.sidebar` (`overflow-y: auto`) into independent scrolling regions.
- **Paginated Game Library with "See more" Option (`src/components/GameLibrary.tsx`)**:
  - Configured defined page size (`PAGE_SIZE = 10`) for game list rendering.
  - Added "See more games (X remaining)" button with smooth expansion.
  - Automatic pagination reset whenever search query, platform, color, result, speed, or sort order changes.
- **Dynamic Analysis Workspace Metadata (`src/App.tsx`)**:
  - Replaced hardcoded demo position values ("makawa7 · 1,205", "Opponent · unrated", "DEMO POSITION") with dynamic game metadata.
  - Populates player names, Elo ratings, time control, platform tag ("LIBRARY GAME"), moves count, and played date directly from `activeGame`.
  - Added "New board" action button to reset to a blank free-analysis sandbox.
- **E2E Test Pipeline Hardening**:
  - Prepend `npm run build` to `test:e2e` in `package.json` to prevent Vite preview from serving stale production bundles during local and CI test execution.
  - Added assertions in `tests/e2e/smoke.spec.ts` verifying real game metadata renders and "DEMO POSITION" text is absent.
- **Database migration** `supabase/migrations/20261103000001_create_games_and_platform_accounts.sql`:
  - `platform_accounts` table with unique constraint on `(user_id, platform, username)` and strict RLS policies.
  - `games` table with unique constraint on `(user_id, fingerprint)`, partial index for `(user_id, platform, external_id)`, and performance indexes on `played_at`, `platform`, and `fingerprint`.
  - Strict RLS policies ensuring users can only read and write their own rows.
- **Pure TypeScript PGN Parser** `src/lib/pgn-parser.ts`:
  - Multi-game streaming and splitting supporting archives up to 5 MB.
  - Seven Tag Roster (STR) + supplementary header parsing (`Event`, `Site`, `Date`, `Round`, `White`, `Black`, `Result`, `WhiteElo`, `BlackElo`, `TimeControl`, `Termination`, `SetUp`, `FEN`, `Variant`).
  - Move validation via `chess.js` verifying legal moves and starting FEN positions.
  - Error isolation: malformed games produce descriptive error reports without blocking valid games in the same file.
  - Time control categorization (`categorizeTimeControl`) into UltraBullet, Bullet, Blitz, Rapid, Classical, and Daily.
  - Canonical SHA-256 fingerprint calculation (`computeGameFingerprint`) based on normalized movetext, players, and date.
  - User color detection based on profile username or email.
- **Games Service** `src/lib/games.ts`:
  - `getGames(userId)` querying Supabase with automatic local storage fallback for unauthenticated / local sessions.
  - `saveParsedGames(parsedGames, source, userId)` with batch deduplication against existing fingerprints.
  - `deleteGame(gameId, userId)` with database and local storage synchronization.
- **Interactive Import Dialog** `src/components/ImportDialog.tsx`:
  - Drag-and-drop file upload supporting `.pgn` and `.txt` files up to 5 MB.
  - Direct PGN text paste tab.
  - Live import report with breakdown of games imported, duplicates skipped, and malformed games with line snippets and reasons.
  - Immediate library refresh callback and navigation shortcut.
- **Game Library Workspace** `src/components/GameLibrary.tsx`:
  - Replaces "My Games" placeholder with a responsive game list.
  - Opponent name, Elo ratings, user color badge, and result pill (Win/Loss/Draw).
  - Time control and platform metadata chips.
  - Search by opponent/player name.
  - Filtering by platform, color, result, and speed/time class.
  - Sorting by date played (newest/oldest).
  - One-click "Analyse" action that loads the complete game into the Analysis board workspace.
  - Game deletion action with confirmation.
- **Dashboard Integration** (`src/App.tsx`):
  - "GAMES IN LIBRARY" stat card updates with live game count.
  - "RECENT ACTIVITY" shows recent games with direct "Analyse" shortcuts.
  - "YOUR FOCUS" provides feedback on progress towards the 20-game baseline needed for engine analysis.
- **Architecture Decision Record** `docs/decisions/0008-pgn-parser-and-fingerprinting.md`.
- **Unit Test Suite** `tests/unit/pgn-parser.test.ts`:
  - 7 tests covering single game parsing, multi-game files, malformed game isolation, fingerprint determinism, time control classification, color detection, and date parsing. All 16 unit tests passing.
- **Playwright E2E Integration Test** `tests/e2e/smoke.spec.ts`:
  - End-to-end test verifying PGN import, duplicate detection, library browsing, and opening a game in the analysis workspace. All 2 E2E tests passing.

---

## [0.1.0] - 2026-11-03

### Added
- **Visual Presentation for Check and Checkmate**:
  - Connected `check: game.inCheck()` to Chessground configuration and state update lifecycle, highlighting the checked king in red.
  - Added pulsating radial crimson highlight style and glow animation for `cg-board square.check`.
  - Added floating game-over banners on the board for Checkmate (`CHECKMATE — [Color] wins by checkmate`) and Stalemate/Draw.
  - Added top toolbar badges in analysis mode showing `[Crown] CHECKMATE · [Color] wins`, `[AlertTriangle] [Color] in check`, and `DRAW · Stalemate`.
  - Disabled board piece movements automatically when `game.isGameOver()` is true.
  - Added unit test in `tests/unit/chess-rules.test.ts` verifying Scholar's Mate checkmate detection (`Qxf7#`).
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
- **Chessground Drawable Support**: enabled right-click square circles and drag arrows with multi-color brush modifiers (Shift, Alt, Ctrl).
- **CI pipeline** `.github/workflows/ci.yml` — runs TypeScript typecheck, Vitest unit tests, and Playwright e2e smoke tests on every push and pull request to `main`.
- **AuthModal full rewrite** `src/components/AuthModal.tsx`:
  - Primary form: email + password sign-in and sign-up (toggle between modes inline).
  - Secondary option: "Continue with Google" OAuth button (uses Supabase `signInWithOAuth` with `redirectTo` callback URL).
  - Show/hide password toggle.
- **Interactive `BoardView`** component in `src/components/BoardView.tsx` wrapping `chessground` with `chess.js` legal move enforcement, drag/drop, and pawn promotion modal.
- **`useAuth` hook** `src/lib/auth.ts` — all four auth methods: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle` (OAuth), `signInWithEmail` (magic link). Callback URL: `https://rjxpuxmwdcqgierciqpg.supabase.co/auth/v1/callback`.
- Authentication status integrated into titlebar and sidebar (initials avatar, sign-in/sign-out).
- ADRs `0001`–`0007` in `docs/decisions/` covering technology choices, RLS, evaluation storage, engine worker, package boundaries, PGN strategy, and licensing.
- Supabase migration `supabase/migrations/20261103000000_create_profiles.sql` — `profiles` table, signup trigger, RLS policies.
- Supabase client helper `src/lib/supabase.ts`.
- License registry `docs/licences.md`.
- Unit test suites: `tests/unit/chess-rules.test.ts` (7 tests), `tests/unit/supabase.test.ts` (2 tests) — all 9 pass.
- Playwright E2E test suite: `tests/e2e/smoke.spec.ts` (1 passed).

### Fixed
- **Playwright E2E timeout in GitHub Actions CI** — root cause: CI environment lacked `VITE_SUPABASE_*` environment variables during `vite build`, causing `AuthModal` to display the "Supabase Unconfigured" warning card instead of the auth form with the "Create one" toggle button. Fixed by supplying environment variables in `.github/workflows/ci.yml` and making `smoke.spec.ts` resilient across all environments.
- **Missing check & checkmate visual presentation** — root cause: Chessground requires `check: true` to render `<square class="check">`. Fixed by connecting `game.inCheck()` to Chessground config and state updates, adding pulsating radial red glow CSS, adding floating Checkmate/Stalemate board banners, and adding status chips to the analysis board topline.
- **Analysis page crash on Black's first move** — root cause: `makeMove` was creating `new Chess(fen)` (losing history), then `displayGame` replayed verbose move objects (with `before`/`after` FEN fields) against a fresh `Chess()`, causing FEN mismatch. Fixed by switching to SAN-array state and SAN-based replay.
- **UI not reflecting logged-in state after sign-in** — root cause: multiple `useAuth()` instances created separate states; lifted into single `AuthContext`.
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
- [x] Tag `v0.1.0` cut and pushed to GitHub.

### Phase 2: Import & Library (Target: v0.2.0)
- [x] Implement pure TypeScript PGN parser with fixture test suite (`src/lib/pgn-parser.ts`, `tests/unit/pgn-parser.test.ts`).
- [x] Implement SHA-256 game fingerprint deduplication (`computeGameFingerprint`).
- [x] Add `games` and `platform_accounts` Supabase tables with RLS and user ownership (`supabase/migrations/20261103000001_create_games_and_platform_accounts.sql`).
- [x] Build drag-and-drop file upload, PGN text paste dialog, and malformed game reporting (`src/components/ImportDialog.tsx`).
- [x] Build game library view with platform, color, result, and time control filters (`src/components/GameLibrary.tsx`).
- [ ] Import real 40-game benchmark dataset and sign off Phase 2 exit criteria.

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

