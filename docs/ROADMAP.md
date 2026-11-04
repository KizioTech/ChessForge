# ChessForge Phased Roadmap

**Version:** 1.1 · 3 November 2026  
**Status:** Active  
**Enforcement Rule:** **Strict Sequential Phase Gate Execution.** No work or progression on any subsequent phase begins until the current phase has met 100% of its exit criteria, passed all phase gate checks, and been formally signed off.

---

## 1. Core Principles & Governance

1. **Ship the Loop First:** A functional personal training loop (Import -> Analyze -> Diagnose -> Exercise Generation -> Spaced Repetition Review) precedes all other features.
2. **Strict Phase Gate Lock:** A phase is closed **only** when all exit criteria, tests, and documentation updates are completed. Work on future phases is locked until the current phase gate is signed off.
3. **Evidence Over Assumptions:** Rolling trends and classifications require a minimum statistical baseline (e.g. at least 20 games) before generating metrics.
4. **Continuous Changelogging:** `CHANGELOG.md` must be created and updated after every edit/pull request to record current progress, completed deliverables, and upcoming requirements.
5. **Real-World Validation:** Use on real games begins at the end of Phase 4. Real training use outranks planned roadmap features.

---

## 2. Phase Gate Verification Checklist

Before closing any phase, every item below must be satisfied:

- [ ] All functional exit criteria for the phase demonstrated and verified.
- [ ] Automated tests added and passing cleanly in CI (`typecheck`, `lint`, `test`).
- [ ] Database schema migrations versioned; RLS enabled and policy tests passing for all new tables.
- [ ] Architecture Decision Records (ADRs) recorded in `docs/decisions/` for significant choices.
- [ ] `CHANGELOG.md` updated under `[Unreleased]` with clear notes.
- [ ] Zero known data-loss or security vulnerabilities open.
- [ ] Phase tag cut and pushed to GitHub (e.g., `v0.1.0`).

---

## 3. Detailed Phase Breakdown

### Phase 0: Baseline & Test Dataset (Pre-Code)
- **Status:** In Progress
- **Release:** N/A (Manual Dataset)
- **Goal:** Establish a human-curated benchmark of 40 games (20 Chess.com + 20 Lichess for user `makawa7`).
- **Deliverables:**
  - Manual review of 20 games per platform.
  - Recorded attributes: Result, opening, major mistake, mistake category (hung piece, missed tactic, ignored threat, time trouble, opening, endgame), clock time at error.
  - Curated golden dataset of 30–50 annotated positions for classifier tuning.
- **Phase Exit Criteria:**
  - [ ] Golden dataset table complete with top five recurring mistake types and counts.
  - [ ] Baseline blunder frequency recorded (blunders per 100 moves baseline).

---

### Phase 1: Foundation & Application Shell
- **Status:** Complete (Signed off)
- **Release Target:** `v0.1.0` (Milestone 1 — Tag Cut)
- **Goal:** Establish project infrastructure, authentication, database schema baseline, and interactive board.
- **Scope & Deliverables:**
  1. Monorepo / workspace setup, TypeScript strict configuration, ESLint, Prettier, Vitest, CI workflow.
  2. Supabase backend integration: `profiles` table with RLS enabled in the same migration, auto-creation trigger on sign-up, RLS cross-user test.
  3. Authentication flow: Supabase Auth (magic link / email), session persistence, protected route guards (public sign-up disabled).
  4. Interactive board: `Chessground` / `chess.js` board wrapper supporting legal move validation, FEN loading, move sound/feedback, flip board, and promotion handling.
  5. UI foundation: Design token system (dark/light themes), responsive layout (collapsible sidebar, page toolbar, empty screen states for primary routes).
  6. License and ADRs: `docs/licences.md` initialized with licenses for Stockfish (GPLv3), Chessground, and chess.js; ADRs 0001 through 0007 documented.
  7. End-to-end smoke test: Playwright test verifying sign-in, navigation, and legal piece movement.
- **Phase Exit Criteria:**
  - [x] User can authenticate, view the application shell, and play legal moves on the board.
  - [x] CI pipeline runs typecheck, lint, and tests cleanly on push.
  - [x] Supabase RLS policies verified by automated tests.
  - [x] Phase 1 checklist complete; tag `v0.1.0` cut.

---

### Phase 2: Import & Game Library
- **Status:** Complete (Signed off)
- **Release Target:** `v0.2.0` (Milestone 2 — Tag Cut)
- **Goal:** Robust client-side PGN parsing, validation, deduplication, and game library management.
- **Scope & Deliverables:**
  1. Database migrations: `games` and `platform_accounts` tables with RLS and user ownership constraints.
  2. Pure TypeScript PGN parser (`packages/chess-core`): Header parsing, move text validation, player color detection, starting FEN support.
  3. Fingerprint deduplication: SHA-256 fingerprint (normalized movetext + players + date) preventing duplicate imports.
  4. Import UI: Drag-and-drop file upload (up to 5 MB), paste PGN dialog, import report (valid vs. malformed breakdown).
  5. Library view: Search, filters (platform, color, result, time control, date), move navigators.
- **Phase Exit Criteria:**
  - [x] 40 real games imported with zero duplicates upon re-upload.
  - [x] Malformed PGN fixtures produce descriptive, non-crashing error messages.
  - [x] Library filters, pagination, and move navigation fully functional.
  - [x] Phase 2 checklist complete; tag `v0.2.0` cut.

---

### Phase 3: Engine & Analysis Pipeline
- **Status:** ✅ Complete (Signed off — commit `ff87fb5`, tag `v0.3.0`)
- **Release Target:** `v0.3.0` (Milestone 3)
- **Goal:** Web Worker Stockfish engine execution and analysis storage.
- **Scope & Deliverables:**
  1. `Engine` interface in `src/lib/engine/` with UCI parser, MultiPV (1..3), depth configuration, and Web Worker lifecycle — **DONE**
  2. Database migrations: `game_analyses` and `positions` tables with RLS — **DONE** (migration `000003`)
  3. Analysis queue manager: Progress reporting, cancellation, graceful abort — **DONE**
  4. White-relative normalization of all scores (ADR 0004) — **DONE**
  5. Evaluation graph component and interactive move analysis pane — **DONE**
  6. Dual-layer persistence (Supabase + LocalStorage, ADR 0009) — **DONE**
- **Phase Exit Criteria:**
  - [x] A 40-move game analyzes to depth 16 MultiPV 3 without freezing the UI.
  - [x] Analysis cancellation cleans up without marking incomplete runs as complete.
  - [x] Results persist and survive browser/app reloads (LocalStorage fallback).
  - [x] EvalGraph renders win-probability swing, clickable ply navigation.
  - [x] tsc --noEmit: 0 errors · npm test: 30/30 · npm run test:e2e: 3/3

---

### Phase 4: Mistakes, Exercise Generation & Spaced Repetition (The Loop Complete)
- **Status:** ✅ Complete (Signed off — tag `v1.0.0`, Milestone 4 - Full R1 Release)
- **Release Target:** `v1.0.0` (Milestone 4 - Full R1 Release)
- **Goal:** Convert engine analysis into actionable personal exercises and spaced review.
- **Scope & Deliverables:**
  1. Move classification: Win-probability loss calculations (Best, Good, Inaccuracy, Mistake, Blunder) — **DONE**
  2. Database migrations: `mistakes`, `training_exercises`, `exercise_attempts`, `review_schedule`, `training_sessions` — **DONE** (migration `000004` applied)
  3. Exercise generator: Eligibility filtering (max 3/game, mover is user, loss >= threshold, win prob 10%–90%, unambiguous solutions) — **DONE**
  4. Interactive solving desk: Legal move checking, multi-solution acceptance, hint support, "Bad exercise" flagging — **DONE**
  5. Modified SM-2 scheduler: Performance-adapted intervals, repetition tracking, daily queue cap — **DONE**
  6. Dashboard metrics: Due exercises count, blunders per 100 moves, training streak — **DONE**
  7. Data export: JSON and PGN export for user data sovereignty — **DONE**
- **Phase Exit Criteria:**
  - [x] Complete loop validated: User imports a game, analyzes it, mistakes populate, exercises generate, and reviews are scheduled.
  - [x] All R1 functional acceptance criteria pass.
  - [x] tsc --noEmit: 0 errors · npm test: 43/43 passing · npm run test:e2e: 4/4 passing.

---

### Phase 5: Insight & Weakness Diagnosis (R2)
- **Status:** In Progress (Current Active Dev Phase — Phase 4 signed off)
- **Release Target:** `v0.5.0`
- **Scope:** Heuristic mistake tagging (hanging piece, missed mate, fork, back-rank), time-trouble detection, performance trend charts with sample sizes (N >= 20).
- **Exit Criteria:** >= 70% agreement on Phase 0 golden dataset for all shipped tags.

---

### Phase 6: Platform Integrations (R2)
- **Status:** Locked (Pending Phase 5 completion)
- **Release Target:** `v0.6.0`
- **Scope:** Automated sync from Chess.com (monthly archives + ETags) and Lichess (rate-limited stream API), background sync checkpoints and logging.
- **Exit Criteria:** Sync operates automatically, handles rate limits (429 backoff), and does not re-import duplicates.

---

### Phase 7: Opening Repertoires (R3)
- **Status:** Locked
- **Release Target:** `v0.7.0`
- **Scope:** Opening repertoire trees for White and Black, practice drilling, game deviation alerts.

---

### Phase 8: Endgame Lab & Calculation (R4)
- **Status:** Locked
- **Release Target:** `v0.8.0`
- **Scope:** Technical endgame practice, tablebase integration, calculation trainer.

---

### Phase 9: Desktop Packaging & Hardening
- **Status:** ✅ Complete (Signed off — delivered ahead of schedule as `v0.4.0` public installer release)
- **Release Target:** ~~`v2.0.0`~~ Shipped early as `v0.4.0`
- **Scope:** Desktop bundle hardening, native Stockfish execution, full offline capabilities, security audit.
- **Delivered:**
  - `electron-builder` integration producing NSIS installer (Windows), DMG (macOS), AppImage (Linux).
  - `dist:app` npm script for single-command installer generation.
  - App icons (`build/icon.ico`, `build/icon.png`) bundled as `extraResources`.
  - `--allow-file-access-from-files` flag for packaged WASM Web Worker execution.
  - Strict CSP enforced in `index.html`.
  - GitHub Release `v0.4.0` published with Windows installer.

---

### Phase 10: Multi-User & Public Readiness (R6)
- **Status:** Locked
- **Release Target:** Post-v2.0.0
- **Scope:** Multi-tenant onboarding, privacy compliance (GDPR), billing/tier limits if applicable, account deletion UX.

---

## 4. Current Status Snapshot

| Phase | Description | Current Status | Blocker / Next Step |
|---|---|---|---|
| **Phase 0** | Baseline & Golden Dataset | **In Progress** | Assemble 40-game spreadsheet for `makawa7` |
| **Phase 1** | Foundation & Shell | ✅ **Complete** | Signed off — `v0.1.0` |
| **Phase 2** | Import & Library | ✅ **Complete** | Signed off — `v0.2.0` |
| **Phase 3** | Analysis Engine | ✅ **Complete** | Signed off — `v0.3.0` |
| **Phase 4** | Mistakes & Exercises | ✅ **Complete** | Signed off — `v0.4.0` (The Loop) |
| **Phase 5** | Insight & Weakness Diagnosis | 🔄 **Active** | Heuristic tagging, trend charts — target `v0.5.0` |
| **Phase 6** | Platform Integrations | **Locked** | Requires Phase 5 gate sign-off |
| **Phase 7** | Opening Repertoires | **Locked** | Future milestone |
| **Phase 8** | Endgame Lab & Calculation | **Locked** | Future milestone |
| **Phase 9** | Desktop Packaging | ✅ **Complete** | Shipped early — `v0.4.0` public installer |
| **Phase 10** | Multi-User & Public Readiness | **Locked** | Post-v2.0.0 |

