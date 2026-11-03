# ChessForge Documentation Set

Version 1.1 · 3 November 2026 · Status: Approved for development

This set replaces the sequencing in the v1.0 specification. The product vision is unchanged. The build order now delivers a working training loop first and defers everything else.

**Contents**

1. Product Requirements Document (PRD)
2. Roadmap, Phases and Changelog
3. Technical Architecture and Data Model
4. Design and UX Specification
5. Security and Compliance
6. AI Development Guide (CLAUDE.md, conventions, prompts, definition of done)

---

## Part 1. Product Requirements Document

### 1.1 Summary

ChessForge is a chess training platform that imports a player's own games, finds their recurring mistakes using Stockfish, turns the right mistakes into personal exercises, and schedules those exercises with spaced repetition. It is built first for one player and architected so other players can be added later.

### 1.2 Problem

Paid tools each cover one slice of improvement: Chessbook for repertoires, Chessreps for opening drilling, Chesstrive for weakness detection. None of them connect a player's own mistakes to a continuous training loop at no cost. Free tools (Lichess analysis, puzzles, Studies) are excellent but do not remember what you personally get wrong, and do not schedule repetition of it.

### 1.3 Target user

**Primary persona: the improving club-level rapid player.**

- Rated about 1200 in rapid on Chess.com and Lichess (username makawa7 on both).
- Plays 10+0 and 15+10.
- Studies in short sessions of 20 to 60 minutes.
- Wants evidence of what is costing rating points, not generic advice.
- Targets: 1400 first, then 1600.

**Future personas (not in scope for release 1):** other self-improvers, and coaches who assign exercises.

### 1.4 Goals and success metrics

| Goal | Metric | Target |
| --- | --- | --- |
| Improve results | Rapid rating on both platforms | 1400 within 6 to 9 months of daily use |
| Reduce tactical errors | Blunders per 100 moves, rolling 30 games | 30 percent lower than baseline after 8 weeks |
| Build a habit | Days with at least one completed review | 5 or more per week |
| Quality of exercises | Exercises the user rates as useful | 70 percent or higher |
| Trust in diagnosis | Agreement between tool tags and the user's manual review of 20 games | 70 percent or higher |
| Cost | Monthly running cost | Zero on free tiers while single user |

A metric only counts when the sample is large enough. Rolling comparisons need at least 20 games before ChessForge shows a trend.

### 1.5 Non-goals for releases 1 and 2

- Building a chess engine, multiplayer server, social features, billing, or a native mobile app.
- An AI chatbot that explains every move.
- A proprietary opening database.
- Any engine assistance during live rated games. ChessForge analyses completed games only.

### 1.6 Release scope

| Release | Name | Contents |
| --- | --- | --- |
| R1 | The Loop | Auth, PGN import, game library, analysis, mistake list, exercise queue, spaced repetition, basic stats |
| R2 | Insight | Weakness tags, trends, recommendations, Chess.com and Lichess sync |
| R3 | Repertoire | Opening trees, drilling, deviation detection |
| R4 | Technique | Endgame lab, calculation trainer |
| R5 | Desktop | Tauri packaging, hardening |
| R6 | Public | Multi-user onboarding, export and deletion UX, licence review, abuse controls |

R1 is the only release that must exist before ChessForge is useful. Everything after it is ordered by expected rating impact.

### 1.7 User stories and acceptance criteria

**Epic A. Collect**

- **US-A1.** As a player, I upload a PGN file or paste PGN text so my games are in the app.
  - Accepts multi-game files up to 5 MB.
  - Invalid games are listed with a reason; valid games still import.
  - Re-uploading the same file creates no duplicates.
  - The original PGN is stored unchanged.
- **US-A2.** As a player, I filter games by platform, colour, result, time control and date.
  - Unrecognised time controls are stored and hidden from the default rapid view until classified.
- **US-A3 (R2).** As a player, I sync new games from Chess.com and Lichess automatically.
  - Sync is resumable, rate-limit safe, and shows a last-synced time.

**Epic B. Analyse**

- **US-B1.** As a player, I run analysis on a game and see progress and a cancel button.
  - Every eligible position is evaluated.
  - Engine version and settings are stored with the result.
  - Closing the tab mid-run leaves no corrupt data; the run resumes or restarts cleanly.
- **US-B2.** As a player, I see an evaluation graph and each move's classification.
- **US-B3.** For Lichess games that already contain evaluations, I can skip local analysis and import those evaluations.

**Epic C. Diagnose**

- **US-C1.** As a player, I see a list of my significant mistakes per game with position, my move, best move and eval swing.
- **US-C2.** As a player, I can correct a mistake's tags, and my correction is remembered.
- **US-C3 (R2).** As a player, I see my weakness breakdown with the evidence games behind each number.

**Epic D. Train**

- **US-D1.** As a player, I am asked to find the move in a position from my own game and get immediate feedback.
  - Accepts any move in the stored acceptable set, not just the engine's first choice.
  - Supports a hint and records its use.
- **US-D2.** As a player, I see a daily queue of due exercises.
- **US-D3.** As a player, I can mark an exercise as bad (no clear task) so it leaves the queue and informs the generator rules.

**Epic E. Measure**

- **US-E1.** As a player, I see mistakes per 100 moves over time, with the sample size shown.
- **US-E2 (R2).** As a player, I see a recommendation with the evidence behind it.

### 1.8 Functional requirements for R1

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-101 | Email or magic-link login via Supabase Auth | Must |
| FR-102 | Every user-owned row carries user\_id and is protected by RLS | Must |
| FR-103 | PGN parsing, validation, metadata extraction, player colour detection | Must |
| FR-104 | Duplicate detection by platform and external id, or content fingerprint | Must |
| FR-105 | Stockfish WASM in a Web Worker with cancel and progress | Must |
| FR-106 | White-relative evaluation storage with mate handling | Must |
| FR-107 | Win-probability based move classification with configurable thresholds | Must |
| FR-108 | Exercise eligibility rules (see Part 3) | Must |
| FR-109 | Interactive solving board with legal move enforcement | Must |
| FR-110 | SM-2 style scheduler with attempt history | Must |
| FR-111 | Dashboard with due count, recent games, mistakes per 100 moves | Must |
| FR-112 | Data export (JSON and PGN) | Should |
| FR-113 | Import Lichess embedded evaluations | Should |
| FR-114 | Light and dark themes | Should |

### 1.9 Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | UI stays responsive during analysis; engine runs off the main thread |
| Reliability | Imported games are never silently lost; every failure is visible and logged |
| Data integrity | Stored FENs and PGNs are validated; all evaluations are reproducible from stored settings |
| Privacy | No analytics tracking beyond what is needed to run the app |
| Accessibility | Keyboard navigation, readable contrast, no information carried by colour alone |
| Portability | The user can export all of their data |
| Cost | Runs on free tiers while single user |

### 1.10 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Stockfish WASM integration is slower or harder than planned | Delays the loop | Use Lichess embedded evals first (US-B3); keep engine behind an interface |
| Poor exercises waste study time | User stops using the app | Strict eligibility rules, a Bad exercise button, manual review of the first 50 exercises |
| Weakness tags are inaccurate | Wrong advice | Ship only high-precision heuristics, show confidence, allow correction |
| Over-building before using it | No rating gain | R1 must be in daily use before R2 starts |
| GPLv3 obligations for Stockfish | Legal risk at public release | Document in Part 5; resolve before R5 |
| Platform API changes | Sync breaks | Manual PGN stays supported; imports sit behind adapters |

### 1.11 Open questions

1. Should exercises be generated automatically after every analysis, or only after the user approves a mistake list? Default for R1: automatic, with a Bad exercise button.
2. Minimum engine depth for R1. Default: depth 16 with MultiPV 3, tuned on the user's hardware during Phase 3.
3. Which Lichess puzzle themes, if any, should seed the library before the user has enough personal exercises? Decision at R2.

---

## Part 2. Roadmap, Phases and Changelog

### 2.1 Principles

1. Ship a usable loop before breadth.
2. Each phase ends with a demo and exit criteria that a person can check.
3. Use the app on real games from the end of Phase 4. Real use outranks planned features.
4. Estimates assume one developer at 10 to 15 hours per week, with AI assistance. They are planning figures, not deadlines.

### 2.2 Phase plan

| Phase | Weeks | Release | Deliverable |
| --- | --- | --- | --- |
| 0. Baseline | Before code | n/a | Manual review of 20 games per platform |
| 1. Foundation | 1 | R1 | App shell, auth, board, CI |
| 2. Import and library | 2 | R1 | PGN upload, library, dedupe |
| 3. Analysis | 3 to 4 | R1 | Engine worker, stored analyses, eval graph |
| 4. Mistakes and exercises | 5 to 6 | R1 | Mistake list, exercise queue, scheduler. **Loop complete** |
| 5. Insight | 7 to 9 | R2 | Weakness tags, trends, recommendations |
| 6. Integrations | 10 to 11 | R2 | Chess.com and Lichess sync |
| 7. Repertoire | 12 to 14 | R3 | Opening trees and drilling |
| 8. Technique | 15 to 17 | R4 | Endgame lab, calculation trainer |
| 9. Desktop and hardening | 18 to 19 | R5 | Tauri build, security review |
| 10. Public readiness | TBD | R6 | Multi-user launch checklist |

### 2.3 Phase details

**Phase 0. Baseline (no code)**

- Analyse 20 recent games from each platform on Lichess.
- Record per game: result, opening, biggest mistake, its category (hung piece, missed tactic, ignored threat, time trouble, opening, endgame), and clock at that moment.
- Save the notes as a spreadsheet. This becomes the classifier test set and your baseline.
- Exit: a table of your top five recurring mistake types with counts.

**Phase 1. Foundation**

- Monorepo with pnpm workspaces; apps/web and packages/chess-core, shared.
- Vite, React, TypeScript strict mode, Tailwind, Vitest, Playwright smoke test.
- Supabase project, first migration, Auth, RLS on profiles.
- Chessground board that renders a FEN and plays legal moves using chess.js.
- GitHub Actions: typecheck, lint, test on every push.
- Exit: you can sign in, see the shell, and move pieces legally on a board. CI is green.

**Phase 2. Import and library**

- Tables: games, platform\_accounts. RLS policies and tests.
- PGN parser in chess-core with a fixture set (valid, malformed, duplicate, non-standard start FEN).
- Upload and paste UI, import report, fingerprint dedupe.
- Library page with filters and a game viewer with move navigation.
- Exit: 40 real games imported with zero duplicates on re-import. Malformed fixtures produce readable errors.

**Phase 3. Analysis**

- Engine interface in packages/engine; Stockfish WASM adapter in a Web Worker; UCI parser.
- Lichess embedded-eval importer as an alternative adapter.
- Tables: game\_analyses, positions. Store engine name, version, depth, MultiPV, hash.
- Queue with progress, cancel and resume.
- White-relative normalisation with mate handling, covered by unit tests.
- Exit: a 40-move game analyses without freezing the UI, results survive a refresh, cancellation leaves no partial rows marked complete.

**Phase 4. Mistakes and exercises (loop complete)**

- Classification module with win-probability thresholds in a config file.
- Table: mistakes. Mistake list and game review screen.
- Exercise generator applying eligibility rules; tables: training\_exercises, exercise\_attempts, review\_schedule.
- Solving board, hint, Bad exercise button, daily queue, SM-2 scheduler.
- Dashboard with due count and mistakes per 100 moves.
- Exit: every Part 1 R1 acceptance criterion passes. You complete a real review session on your own games.

**Phase 5. Insight (R2)**

- Heuristic tags: hanging piece, missed mate, missed capture of undefended piece, back-rank, missed fork. Each has a precision test on the Phase 0 set.
- Time-pressure tag using clock data where present.
- Trend charts with sample-size labels; recommendations that cite evidence games.
- Exit: at least 70 percent agreement on your Phase 0 set for each shipped tag.

**Phase 6. Integrations (R2)**

- Adapter interface per platform. Server-side Edge Functions for Chess.com archives (ETag aware) and Lichess export (one request at a time, back off one minute after a 429).
- Import checkpoints, logs, last-synced timestamp, manual fallback unchanged.
- Exit: a second sync imports only new games.

**Phases 7 to 10** follow the Part 1 release table. Each gets a short plan written at the end of the previous phase, using what real use has revealed.

### 2.4 Phase gate checklist

A phase is closed only when all of the following are true:

- Exit criteria demonstrated.
- Tests added and passing in CI.
- RLS policies and tests updated for any new table.
- CHANGELOG updated.
- docs/decisions has an ADR for any significant choice.
- No known data-loss bug open.

### 2.5 Versioning and changelog policy

- Semantic Versioning. 0.x while pre-R1 is complete, 1.0.0 at the end of Phase 4 once you have used it for two weeks without data-loss bugs.
- Format follows Keep a Changelog: Added, Changed, Deprecated, Removed, Fixed, Security.
- Every merged pull request adds one line under Unreleased.
- Each phase gate cuts a tagged release.

**CHANGELOG.md (starter)**

```
# Changelog
All notable changes to ChessForge are documented here.
Format: Keep a Changelog. Versioning: Semantic Versioning.

## [Unreleased]
### Added
- Documentation set v1.1 (PRD, roadmap, architecture, design, security, AI guide).

## [0.0.0] - 2026-11-03
### Added
- Project charter and v1.0 specification.
```

**Planned milestone tags**

| Tag | Phase | Meaning |
| --- | --- | --- |
| v0.1.0 | 1 | Shell, auth, board |
| v0.2.0 | 2 | Import and library |
| v0.3.0 | 3 | Analysis |
| v1.0.0 | 4 | The Loop |
| v1.1.0 | 5 | Insight |
| v1.2.0 | 6 | Platform sync |
| v1.3.0 | 7 | Repertoire |
| v1.4.0 | 8 | Technique |
| v2.0.0 | 9 | Desktop |

---

## Part 3. Technical Architecture and Data Model

### 3.1 React or Rust: the decision

These are not competing choices. React is a library for building user interfaces in the browser. Rust is a systems language. The real question is which language the main application should be written in.

**Decision: React with TypeScript for the application. Rust only where it is forced on us.**

| Factor | React + TypeScript | Rust |
| --- | --- | --- |
| Fit for this product | Excellent: boards, lists, charts, forms | Poor for UI unless using a Rust web framework with a far smaller ecosystem |
| Chess libraries | chess.js, Chessground, Stockfish WASM builds, all JavaScript-native | Fewer UI-ready equivalents |
| Speed of development | Fast, with strong AI-assistant support | Slower, steeper learning curve |
| Raw compute speed | Adequate: heavy work is in Stockfish, which is already compiled | Faster, but not the bottleneck here |
| Hiring and contributors later | Large pool | Small pool |
| Desktop packaging | Tauri wraps the same React app | Tauri's shell is already Rust |

**Where Rust appears anyway.** Tauri's native shell is written in Rust. For ChessForge that means a small amount of configuration and glue, and possibly one command that launches a native Stockfish binary for faster desktop analysis. You do not need to learn Rust to ship R1 to R4.

**When to revisit.** Only if profiling shows a specific computation (for example, bulk tactical-pattern detection over thousands of games) is too slow in TypeScript. The fix would then be a small Rust module compiled to WebAssembly behind the same interface, not a rewrite.

### 3.2 Stack summary

| Layer | Choice |
| --- | --- |
| UI | React 18+, TypeScript (strict), Vite, Tailwind CSS |
| State and data fetching | TanStack Query for server data, Zustand for local UI state |
| Chess logic | chess.js (rules, PGN, FEN), Chessground (board) |
| Engine | Stockfish WASM in a Web Worker, behind an `Engine` interface |
| Backend | Supabase: PostgreSQL, Auth, Edge Functions |
| Charts | Recharts |
| Tests | Vitest, Playwright |
| Desktop (R5) | Tauri 2 |
| Tooling | pnpm workspaces, ESLint, Prettier, GitHub Actions |

Pin all dependency versions and record the Stockfish build, version and licence in `docs/licences.md` from the day it is added.

### 3.3 Repository structure (grow it as needed)

```
chessforge/
  apps/web/            React app (feature folders under src/features)
  apps/desktop/        Tauri shell (Phase 9)
  packages/chess-core/ FEN, PGN, positions, validation. No React, no network.
  packages/engine/     Engine interface, Stockfish adapter, UCI parser, worker
  packages/analysis/   Normalisation, classification, game reports
  packages/training/   Exercise generator, scheduler, recommendations
  packages/shared/     Types, constants, config
  supabase/migrations/ Versioned SQL
  supabase/functions/  Edge Functions (import adapters)
  supabase/tests/      RLS policy tests
  tests/e2e/           Playwright
  docs/                requirements, architecture, decisions (ADRs), licences
```

Create a folder only when the first file for it exists.

### 3.4 Module boundaries (enforced by lint rules)

- `chess-core`, `analysis` and `training` are pure TypeScript: no React, no browser APIs, no Supabase client. They take data in and return data out, which makes them testable and reusable on a server or desktop later.
- `engine` is the only package that talks to a Web Worker or native process.
- `apps/web` is the only place that calls Supabase.
- Dependency direction: `apps/web` to `training` and `analysis` to `chess-core` and `shared`. Never the reverse.

### 3.5 Engine interface

```ts
export interface EngineConfig {
  depth?: number;        // default 16
  nodes?: number;
  multiPv: number;       // 1..3
  hashMb: number;
  threads: number;
}

export interface EngineLine {
  rank: number;                 // MultiPV index, 1-based
  scoreCp?: number;             // White-relative centipawns
  mateIn?: number;              // White-relative: positive = White mates
  pv: string[];                 // UCI moves
  depth: number;
}

export interface EngineResult {
  fen: string;
  lines: EngineLine[];
  engineName: string;
  engineVersion: string;
  config: EngineConfig;
  complete: boolean;            // false if stopped early
}

export interface Engine {
  init(): Promise<void>;
  analyse(fen: string, config: EngineConfig, signal: AbortSignal,
          onProgress?: (r: EngineResult) => void): Promise<EngineResult>;
  dispose(): void;
}
```

The Lichess embedded-eval importer implements a sibling `EvalSource` interface that returns the same `EngineLine` shape (single line, no MultiPV), so downstream code does not care where evaluations came from. Store the source with each analysis.

### 3.6 Evaluation normalisation and classification

**Normalisation.** Stockfish reports scores from the side to move. Convert every score to White-relative immediately after parsing: if Black is to move, negate the centipawn or mate value. Never store side-relative scores.

**Win probability.** Convert centipawns to a win percentage for the player who moved:

```
winPct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
mate for the mover  -> 100
mate against mover  -> 0
```

**Move loss.** For the player who just moved:

```
before = winPct(eval of best line in the position before the move, mover's view)
after  = winPct(eval of position after the played move, mover's view)
loss   = before - after      (floor at 0)
```

**Default thresholds (win percentage points, configurable in `shared/config`, to be calibrated on the Phase 0 set):**

| Label | Loss |
| --- | --- |
| Best or excellent | Played move is rank 1, or loss under 1 |
| Good | Under 5 |
| Inaccuracy | 5 to under 10 |
| Mistake | 10 to under 20 |
| Blunder | 20 or more |

Win probability is used instead of raw centipawns because 200 centipawns lost in an equal position matters far more than 200 lost in a position that is already +10.

**Edge cases that must have tests:** mate in N and mate against; mate to non-mate transitions; positions where engine and played move are the same; incomplete searches (mark `complete = false`, never classify); non-standard starting FEN; threefold repetition and fifty-move draws (use eval 0 for the terminal position); book moves in the first plies (do not penalise moves within a configurable opening window unless loss is a blunder).

**Opportunity flag.** Mark a position as a missed opportunity when the best move gains at least 15 win points over the second-best line and the played move was neither of them.

### 3.7 Exercise eligibility rules

A mistake becomes an exercise only if all of these hold:

1. The mover is the user and the classification is Mistake or Blunder.
2. The analysis is complete and at or above the minimum depth.
3. The position before the move is not already decided: best-line win percentage for the mover is between 10 and 90.
4. A clear task exists. Either the best move beats the second-best by 10 or more win points (single solution), or the acceptable set is every move within 3 win points of the best (multi-solution).
5. The solution line is 4 plies or fewer for R1, or ends in a forced mate in 3 or fewer.
6. The position (by FEN) is not already an exercise for this user.
7. At most 3 exercises per game, chosen by largest loss.

Exercise types, chosen automatically:

- **Attack:** find the winning or best move.
- **Defence:** find the move that holds the position. Prompt text reflects this so the user is not forced into a made-up combination.
- **Avoid the blunder:** show the position and ask for a safe move; the user's original move is marked as the trap.

Every exercise has a Bad exercise button. Flagged exercises are removed from the queue and stored with a reason so the rules can be tuned.

### 3.8 Spaced repetition (modified SM-2)

State per exercise: `repetitions`, `ease_factor` (start 2.5, minimum 1.3), `interval_days`, `due_at`, `lapses`.

Grade is derived from the attempt, with an optional manual override:

| Attempt | Grade |
| --- | --- |
| Wrong, or gave up | Again |
| Correct but used a hint, or took over 2x your median time | Hard |
| Correct, no hint, normal time | Good |
| Correct, no hint, fast, and confidence marked high | Easy |

Update rules:

```
Again: repetitions = 0, lapses += 1, ease -= 0.20 (min 1.3), due_at = now + 10 minutes
Hard:  interval = max(1, interval * 1.2), ease -= 0.15
Good:  repetitions += 1
       interval = 1 day if repetitions == 1
                  3 days if repetitions == 2
                  round(previous interval * ease) otherwise
Easy:  as Good, then interval *= 1.3, ease += 0.15
Cap interval at 60 days. Exercises with 5 or more consecutive Good or Easy results are marked Mastered and leave the daily queue.
```

The starting intervals in the v1.0 table (10 minutes, 1, 3, 7, 14, 30 days) remain the intent; the formula above generates a similar curve and adapts to performance. All constants live in config.

Cap daily new-exercise intake at a configurable number (default 10) so the queue never becomes a chore.

### 3.9 Data model

All tables use UUID primary keys, `created_at`, and `user_id` where user-owned. Foreign keys are enforced. RLS is enabled on every table in the same migration that creates it.

| Table | Key columns |
| --- | --- |
| profiles | id (= auth.users.id), display\_name, settings jsonb |
| platform\_accounts | id, user\_id, platform, username, last\_synced\_at, sync\_cursor jsonb |
| games | id, user\_id, platform, external\_id, fingerprint, pgn, white, black, user\_colour, result, termination, time\_control, time\_class, rated, played\_at, variant, start\_fen, source (upload, chesscom, lichess) |
| game\_analyses | id, game\_id, user\_id, source (stockfish, lichess\_eval), engine\_name, engine\_version, depth, multipv, hash\_mb, status (queued, running, complete, failed, cancelled), started\_at, finished\_at |
| positions | id, analysis\_id, game\_id, user\_id, ply, fen, side\_to\_move, played\_uci, clock\_ms, eval\_cp, mate\_in, lines jsonb |
| mistakes | id, user\_id, game\_id, position\_id, engine\_class, win\_pct\_loss, best\_uci, tags text\[\], tag\_confidence jsonb, user\_corrected boolean, note |
| training\_exercises | id, user\_id, mistake\_id, fen, user\_colour, exercise\_type, solutions jsonb, principal\_variation jsonb, themes text\[\], difficulty, status (active, mastered, flagged), flag\_reason |
| exercise\_attempts | id, exercise\_id, user\_id, attempted\_at, correct, duration\_ms, hints\_used, moves\_tried jsonb, grade |
| review\_schedule | exercise\_id (pk), user\_id, due\_at, interval\_days, ease\_factor, repetitions, lapses |
| training\_sessions | id, user\_id, started\_at, ended\_at, exercises\_done |
| performance\_snapshots | id, user\_id, platform, time\_class, rating, recorded\_at |
| import\_logs | id, user\_id, source, started\_at, finished\_at, games\_seen, games\_added, games\_skipped, errors jsonb |
| opening\_repertoires, opening\_lines | Added in Phase 7 |

**Constraints and indexes**

- `games`: unique (user\_id, platform, external\_id) where external\_id is not null; unique (user\_id, fingerprint) always.
- Fingerprint: SHA-256 of normalised movetext plus white, black, and date. Used for manual uploads and as a safety net for synced games.
- Indexes on (user\_id, played\_at desc), (analysis\_id, ply), (user\_id, due\_at) on review\_schedule.
- `positions.lines` holds MultiPV output as JSONB. Everything queried or aggregated is a real column.

**RLS pattern (every user-owned table):**

```sql
alter table games enable row level security;
create policy "own rows" on games
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

### 3.10 Import design

- Parsing runs in the browser for uploads, using chess-core, so errors can be shown per game before anything is saved.
- Platform sync runs server-side in Edge Functions. Credentials never reach the browser.
- Each adapter implements `listNewGames(account, cursor)` and returns normalised game records plus a new cursor. Adapters are pure with respect to storage; a shared importer writes rows, deduplicates and logs.
- Chess.com: read the archive index, fetch monthly archives, send If-None-Match with stored ETags, skip unchanged months.
- Lichess: one request at a time, request `clocks`, `opening` and `evals` where available, wait at least 60 seconds after a 429.
- Every run writes an `import_logs` row. Failures are resumable from the saved cursor.

### 3.11 Testing strategy

| Level | Scope | Tool |
| --- | --- | --- |
| Unit | chess-core, analysis, training (pure functions) | Vitest |
| Property | Normalisation and scheduler invariants (for example, due dates never move backwards after a success) | Vitest with fast-check |
| Fixtures | Curated PGNs and FENs: castling, en passant, four promotions, stalemate, repetition, fifty-move, forced mate, non-standard start | Vitest |
| Policy | Cross-user access attempts return nothing | SQL tests in supabase/tests |
| Integration | Import pipeline with a local Supabase | Vitest |
| End to end | Upload, analyse, solve an exercise, see it rescheduled | Playwright |

**Golden set.** Keep 30 to 50 of your own positions from Phase 0, each with your hand-labelled mistake type. Classifier changes must not reduce agreement on this set without an ADR explaining why.

---

## Part 4. Design and UX Specification

### 4.1 Design principles

1. **The board is the hero.** On every training and review screen the board gets the largest share of space.
2. **Evidence over decoration.** Every number shows its sample size; every recommendation links to the games behind it.
3. **Calm and fast.** No animations beyond piece movement and subtle state changes. Sessions should start in one click.
4. **Never rely on colour alone.** Move classifications use an icon and a label as well as a colour.
5. **Keyboard first on desktop, thumb friendly on mobile.**
6. **Honest states.** Every screen has designed loading, empty, error and partial-data states.

### 4.2 Information architecture

Primary navigation: Dashboard, Games, Train, Review Queue, Analytics, Settings. Openings and Endgames appear in the navigation only when those releases ship.

| Screen | Release | Purpose |
| --- | --- | --- |
| Dashboard | R1 | Due exercises, recent games, mistakes per 100 moves, one call to action |
| Games | R1 | Library, filters, upload and paste |
| Game review | R1 | Board, move list, evaluation graph, mistake markers |
| Mistake detail | R1 | Position, your move, best line, tags, correct or flag |
| Train / Review Queue | R1 | Exercise board and feedback; the queue and Train share one solving screen |
| Analytics | R1 basic, R2 full | Trends with sample sizes, weakness breakdown |
| Settings | R1 | Accounts, engine depth, thresholds, theme, data export |
| Openings | R3 | Repertoire tree, drilling |
| Endgame lab | R4 | Structured exercises |

### 4.3 Layouts

**Desktop (1024 px and wider).** Left sidebar (collapsible), main content area. Game review and Train use two columns: board left (square, as large as fits), panel right (moves, evaluation, feedback).

**Tablet (640 to 1023 px).** Top bar navigation, board above panel.

**Mobile (under 640 px).** Bottom tab bar with four items (Dashboard, Games, Train, Analytics), Settings under a profile menu. Board spans full width; panel scrolls beneath. Move input by tap-to-move as well as drag.

### 4.4 Key screens

**Dashboard**

- Top card: "12 exercises due" with a Start button. If none are due: next due time and an option to review recent games.
- Row of three stat tiles: mistakes per 100 moves (last 20 games), exercises mastered, current streak. Each tile shows its sample size and a tooltip explaining the calculation.
- Recent games list with result, opening, and number of blunders.
- Analysis queue status if anything is running.

**Game review**

- Board with arrows: green for engine best move, red for the played move when it was a mistake or blunder.
- Evaluation bar on the board edge, evaluation graph below with mistake markers you can click.
- Move list with classification badges. Keyboard: left and right arrows step, up and down jump to previous or next mistake, F flips the board.
- Panel tabs: Moves, Mistakes, Info.

**Mistake detail**

- Position before the move, your move, best move, win percentage change as a plain sentence ("Your chance of winning dropped from 58% to 21%").
- Tag chips with confidence (for example, Hanging piece, 90%), an Edit tags action, and a Create exercise or Flag as not useful action.
- Clock at the time of the move when available.

**Solving screen**

- Prompt line reflects the exercise type: "Find the best move for White", "Find a move that holds the position", or "Avoid the blunder".
- Feedback states: correct, correct but not the main line (show the main line), incorrect with one retry then reveal, hint used.
- Controls: Hint, Show solution, Skip, Bad exercise. Timer is visible but unobtrusive.
- After each exercise show next due date in plain words ("Back in 3 days").
- Session end: summary of results and a link to the games the exercises came from.

**Analytics (R1 basic)**

- Mistakes per 100 moves, blunders per game, accuracy by game phase, results by colour.
- Every chart displays n (number of games or moves). Fewer than 20 games shows a notice instead of a trend line.

### 4.5 Design tokens

Implement as CSS variables consumed by Tailwind so light and dark themes share one set of names.

| Token | Light | Dark |
| --- | --- | --- |
| --bg | #FAFAF8 | #151716 |
| --surface | #FFFFFF | #1E2120 |
| --border | #E3E3DE | #2E3230 |
| --text | #1B1D1C | #ECEDEB |
| --text-muted | #5E6360 | #A3A8A5 |
| --accent | #2F6F4F | #5FB58A |
| --danger | #B3261E | #F2877F |

Check contrast ratios when finalising; body text must meet at least 4.5 to 1.

**Move classification colours and icons**

| Class | Colour | Icon | Label |
| --- | --- | --- | --- |
| Best | Teal | Star | Best |
| Good | Green | Check | Good |
| Inaccuracy | Yellow | ?! | Inaccuracy |
| Mistake | Orange | ? | Mistake |
| Blunder | Red | ?? | Blunder |
| Missed opportunity | Purple | Target | Missed chance |

**Typography.** System font stack for UI (Inter if a webfont is wanted), tabular numerals for evaluations and clocks, monospace only for FEN and PGN. Scale: 12, 14, 16, 20, 24, 32.

**Spacing and shape.** 4 px base unit; radius 8 px for cards, 6 px for controls; one level of elevation.

**Board.** Default theme with neutral green and cream squares, plus two alternatives chosen in Settings. Piece set selectable. Coordinates shown. Last move highlighted. Legal-move dots on tap or drag start.

### 4.6 Component inventory

BoardView (wraps Chessground), MoveList, EvalBar, EvalGraph, ClassificationBadge, TagChip, ExerciseCard, StatTile (with sample-size label), QueueProgress, EmptyState, ErrorState, FileDropzone, ImportReport, FilterBar, ConfirmDialog, Toast.

Build each in isolation first and document it in a simple component page at `/dev/components` (development only).

### 4.7 States and copy

| State | Behaviour |
| --- | --- |
| Empty library | "No games yet. Upload a PGN file to get started." with a primary Upload button |
| Import with errors | Summary at top ("38 imported, 2 skipped"), expandable list with reasons |
| Analysis running | Progress per game, cancel button, UI stays interactive |
| Analysis failed | Plain reason and a Retry button; nothing partial is shown as complete |
| No exercises due | Next due time and one suggested action |
| Insufficient data | "Needs 20 games for a reliable trend. You have 11." |

Tone: direct, plain, encouraging without cheerleading. No exclamation marks in error messages.

### 4.8 Accessibility checklist

- Full keyboard operation including board moves (type a move in SAN as an alternative to dragging).
- Visible focus rings.
- Screen reader labels for pieces, squares, evaluation and move classifications; live region announces correct and incorrect results.
- Respect reduced-motion settings.
- Touch targets at least 44 px.
- Test with keyboard only and one screen reader before R1 is declared complete.

---

## Part 5. Security and Compliance

### 5.1 Threat model (summary)

| Asset | Threat | Primary control |
| --- | --- | --- |
| Games, exercises, history | Another user reads or changes them | RLS on every table, tested |
| Accounts | Credential theft, session hijack | Supabase Auth, short-lived tokens, MFA available |
| Platform tokens (future OAuth) | Leakage | Server-side only, encrypted at rest, never logged |
| Service-role key | Exposure in browser or repo | Server environment only, secret scanning in CI |
| Upload endpoint | Malicious or oversized files | Size and type limits, parse in sandboxed worker, validate before save |
| Edge Functions | Abuse, cost overrun | Per-user rate limits, request timeouts |
| Browser app | XSS | Strict CSP, no `dangerouslySetInnerHTML` on imported text |
| Dependencies | Supply-chain attack | Lockfile, pinned versions, audit in CI |

### 5.2 Authentication and authorisation

- Supabase Auth with email magic link or password plus optional TOTP. Public sign-up stays disabled until R6; create your own account manually.
- Sessions in memory plus httpOnly refresh handling as provided by the Supabase client configuration; do not store tokens in custom localStorage keys.
- The `anon` key may be in the frontend; the `service_role` key must never be.
- Authorisation is enforced in the database, not in the UI.

### 5.3 Row Level Security rules

1. RLS is enabled in the same migration that creates the table. CI fails if any table in `public` has RLS off.
2. Policies use `(select auth.uid())` and check both `using` and `with check`.
3. Child tables carry their own `user_id` (denormalised) so policies stay simple and fast.
4. Policy tests: a second test user attempts select, insert, update and delete on the first user's rows for every table; every attempt must return nothing or fail.
5. Views that bypass RLS use `security_invoker = true`.
6. Edge Functions use the caller's JWT where possible; the service role is used only for admin tasks, and every such function re-checks ownership explicitly.

### 5.4 Input validation

- Uploads: accept `.pgn` and plain text only; reject over 5 MB; reject binary content; limit games per upload to a sensible cap (for example, 2,000).
- PGN and FEN are parsed and validated by chess-core. Reject illegal positions and illegal move sequences with a reason per game.
- All strings from PGN headers (player names, events) are treated as untrusted text and rendered as text, never as HTML.
- Server functions validate request bodies with a schema library (for example, Zod) and reject unknown fields.
- Exercise answers are validated by legality and by membership in the stored solution set on the client for responsiveness, and the attempt result is recorded as provided; because exercises are private to the user, client-side checking is acceptable. Revisit for any public or competitive feature.

### 5.5 Secrets and configuration

- `.env` files are git-ignored; commit only `.env.example`.
- Production secrets live in Supabase and the hosting provider's secret store.
- Enable GitHub secret scanning and push protection.
- Rotate keys if ever exposed, and document the procedure in `docs/runbooks/key-rotation.md`.
- Logs must never contain tokens, passwords, or full PGN contents.

### 5.6 Browser and hosting hardening

- Content Security Policy, starting strict: `default-src 'self'`; allow `'wasm-unsafe-eval'` for WebAssembly; connect only to the Supabase project origin; no inline scripts.
- Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locked down, HSTS.
- **Multithreaded Stockfish WASM needs `SharedArrayBuffer`**, which requires cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`). Decide in Phase 3 whether to use the single-threaded build (simpler hosting, slower) or enable cross-origin isolation (faster; affects embedded third-party content). Record the outcome as an ADR.
- HTTPS only; no mixed content.

### 5.6a Third-party API conduct

- Chess.com PubAPI: read-only public data; send a descriptive User-Agent with contact details; use ETag and Last-Modified conditional requests; do not hammer endpoints.
- Lichess API: one request at a time per user; after a 429, wait at least one minute; use personal or OAuth tokens only when needed, with minimal scopes, stored server-side.
- Both: re-check the current terms before each release that changes sync behaviour.
- Platform imports must continue to work when only manual upload is available.

### 5.7 Fair play boundary

ChessForge analyses completed games and trains the user. It must never offer analysis during a live rated game, never automate moves, and never scrape or interact with platform sites in a way that could be used to cheat. State this in the README and the in-app About page.

### 5.8 Privacy and data rights

- Collect only what is needed: email, platform usernames, imported games, training data.
- No third-party advertising or behavioural tracking. If product analytics are added later, make them opt-in and aggregate.
- Export: one action that produces a ZIP with JSON (exercises, attempts, schedule, mistakes) and PGN (games).
- Deletion: one action that removes all rows for the user and the auth account, with confirmation and a clear explanation that it is permanent. Verify with a test that no rows remain.
- Publish a short privacy notice before R6. If serving users in the EU or UK, document the lawful basis, retention periods and a contact for requests (GDPR obligations apply at that point).
- Define retention: raw engine lines older than a chosen period may be pruned; PGNs and exercises are kept until the user deletes them.

### 5.9 Backup and recovery

- Enable Supabase backups appropriate to the plan; on the free tier, run a scheduled export of the database to private storage.
- Test a restore into a scratch project before R1 is declared complete, and again before R6.
- Migrations are the source of truth for schema; never change production schema by hand.

### 5.10 Licensing and compliance register

Maintain `docs/licences.md` with each dependency, version, licence, and obligation. Items to resolve early:

| Component | Licence note | Action |
| --- | --- | --- |
| Stockfish | GPLv3 | If you distribute the app (web or desktop) with Stockfish, comply with GPLv3: provide corresponding source and notices. Decide before the first public release. |
| Chessground | GPL-3.0 | Using it in a distributed app has the same effect; the combined work generally needs to be offered under GPL-compatible terms. Confirm with the current licence text. |
| chess.js | BSD-2-Clause | Keep notice |
| Lichess puzzle and opening data | Openly licensed (check current terms per dataset) | Record attribution requirements before use |
| Tauri, React, Supabase client | Permissive | Keep notices |

Practical consequence: the simplest honest path is to release ChessForge's own code under GPLv3 (or a GPL-compatible licence) when it becomes public. Take legal advice before commercialising, since GPL affects paid or closed distribution. This is a planning note, not legal advice.

### 5.11 Security gates by phase

| Phase | Required before closing |
| --- | --- |
| 1 | RLS on profiles, secret scanning on, CSP draft |
| 2 | RLS and policy tests on games and platform\_accounts; upload limits tested |
| 3 | Analyses and positions RLS; cancel and resume leave no cross-user data |
| 4 | Exercise tables RLS; export works |
| 6 | Edge Function rate limits, server-only secrets, import logs scrub tokens |
| 9 | Dependency audit, full policy test run, restore drill, desktop update channel signed |
| 10 | Penetration-style review of auth and RLS, privacy notice, deletion verified, abuse controls |

---

## Part 6. AI Development Guide

This part is written so an AI coding assistant (for example Claude Code) can build ChessForge reliably, and so you can review its work. Copy the relevant sections into the repository as listed.

### 6.1 Files to create in the repository

| File | Source |
| --- | --- |
| `CLAUDE.md` | Section 6.2, kept short and updated often |
| `docs/PRD.md` | Part 1 |
| `docs/ROADMAP.md` | Part 2 |
| `docs/ARCHITECTURE.md` | Part 3 |
| `docs/DESIGN.md` | Part 4 |
| `docs/SECURITY.md` | Part 5 |
| `docs/decisions/` | ADRs from 6.7 |
| `docs/licences.md` | Created in Phase 1, updated with every dependency |
| `CHANGELOG.md` | Part 2 starter |
| `.env.example` | Variable names only, no values |

The assistant reads `CLAUDE.md` every session, so it must stay under roughly 150 lines and point to the longer docs rather than repeat them.

### 6.2 CLAUDE.md (starter content)

```
# ChessForge: instructions for AI assistants

## What this is
A chess training app: import games, analyse with Stockfish, find recurring
mistakes, generate personal exercises, schedule them with spaced repetition.
Full docs in /docs. Read docs/ROADMAP.md to see the current phase before starting.

## Current phase
Phase 1: Foundation. (Update this line at every phase gate.)

## Stack
React + TypeScript (strict), Vite, Tailwind, TanStack Query, Zustand,
chess.js, Chessground, Stockfish WASM in a Web Worker, Supabase
(Postgres, Auth, Edge Functions), Vitest, Playwright, pnpm workspaces.

## Commands
pnpm install        install dependencies
pnpm dev            run the web app
pnpm test           run unit tests
pnpm test:e2e       run Playwright
pnpm typecheck      tsc across all packages
pnpm lint           eslint and prettier check
supabase db reset   rebuild the local database from migrations
supabase test db    run RLS policy tests

## Architecture rules (do not break)
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

## Security rules
- Never put the service-role key or any secret in frontend code, logs, or git.
- Treat all PGN text (names, events, comments) as untrusted. Render as text only.
- Validate every external input (PGN, FEN, request bodies) before use.
- No engine assistance in live games. Completed games only.

## Working style
- Before coding anything larger than a small fix, write a short plan and wait
  for approval.
- Write or update tests first for anything in chess-core, analysis, training.
- Keep changes small: one concern per pull request.
- Do not add dependencies without asking. If one is needed, state its licence
  and add it to docs/licences.md.
- Do not invent library APIs. Check the installed version's types or docs.
- Do not mark work done unless typecheck, lint and tests pass.
- Add a line to CHANGELOG.md under Unreleased for every user-visible change.
- When a decision is non-obvious, write an ADR in docs/decisions.

## Out of scope (until the roadmap says otherwise)
Openings, endgames, desktop packaging, billing, social features, chatbots.

## Conventions
- Files: kebab-case. React components: PascalCase. Types: PascalCase.
- No default exports except pages and lazy routes.
- Prefer pure functions and explicit types over classes.
- Money-saving rule: stay inside free tiers.
```

### 6.3 Working agreement between you and the AI assistant

1. **Plan, then build.** For every task the assistant proposes a plan listing files to change, tests to add, and risks. You approve or adjust it.
2. **One task per session where possible.** Long sessions drift. Start fresh sessions for new tasks and rely on `CLAUDE.md` and the docs for context.
3. **Tests first for domain logic.** The classifier, scheduler, normalisation, PGN parser and exercise generator are written test-first using fixtures from Part 3.11.
4. **You review every migration and every RLS policy by hand.** These are the highest-risk outputs.
5. **Verify, do not trust.** After each task, run the commands in 6.6 yourself.
6. **Ask for evidence.** When the assistant claims a library supports something, ask it to point to the installed type definitions or documentation.
7. **Keep a running notes file** (`docs/NOTES.md`) of surprises, so lessons survive between sessions.

### 6.4 Task specification template

Use this for every ticket you hand to the assistant.

```
Title:
Phase and release:
Goal (one sentence, user-visible if possible):
Context (links to PRD stories, architecture sections):
Scope (what to build):
Out of scope (what not to touch):
Files or packages likely involved:
Data changes (migration needed? RLS?):
Acceptance criteria (checkable bullets):
Tests required:
Security considerations:
Docs to update:
```

### 6.5 Prompt templates

**Start a task**

```
Read CLAUDE.md and docs/ROADMAP.md. We are working on: <ticket>.
Do not write code yet. Propose a plan: files to create or change, tests to add,
migrations needed, risks, and anything in the docs you find unclear or in conflict.
```

**Implement domain logic test-first**

```
Implement <module> following docs/ARCHITECTURE.md section <n>.
First write failing tests covering: <cases, including edge cases from section 3.6>.
Show me the tests, then implement until they pass. Do not change the tests to
make them pass without telling me why.
```

**Write a migration**

```
Create a Supabase migration for <tables>. Requirements: UUID primary keys,
user_id on user-owned tables, foreign keys, indexes from docs/ARCHITECTURE.md
3.9, RLS enabled in this same migration with policies using (select auth.uid()).
Also add a policy test in supabase/tests that proves a second user cannot read or
write these rows. Do not apply it; show me the SQL first.
```

**Review a change**

```
Review the current diff against CLAUDE.md, docs/SECURITY.md and docs/ARCHITECTURE.md.
List violations of the architecture and security rules, missing tests, and any place
untrusted input reaches the UI or database unvalidated. Be specific with file and line.
```

**Debug**

```
Problem: <what happened vs expected>. Steps to reproduce: <steps>.
Before changing code, list three hypotheses ranked by likelihood and the quickest
check for each. Then test the top one.
```

**Tune the classifier**

```
Run the classifier over the golden set in tests/fixtures/golden. Report agreement
with my labels per tag and per class, list every disagreement with FEN and both
labels, and propose threshold or rule changes. Do not change thresholds until I approve.
```

### 6.5a Rules for the AI on chess correctness

- Always use chess.js for legality; never write custom move generation.
- Convert engine scores to White-relative immediately after parsing UCI output.
- Never compare centipawn scores across sides without normalising first.
- Treat mate scores separately from centipawns; never add or average them.
- When replaying a game, honour a starting FEN header if present.
- A position repeated or a drawn terminal state evaluates as 0, not as the last engine score.
- Do not classify the user's opponent's moves as the user's mistakes. Filter by `user_colour`.

### 6.6 Definition of done (per task and per pull request)

- [ ] Acceptance criteria met and demonstrated.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- [ ] New or changed domain logic has tests, including edge cases.
- [ ] New tables have RLS enabled, policies, and policy tests.
- [ ] No secrets, tokens, or personal data in code, logs, or fixtures.
- [ ] Loading, empty and error states exist for any new screen.
- [ ] Keyboard operation works for any new interactive element.
- [ ] CHANGELOG updated; docs updated where behaviour changed.
- [ ] ADR written if a significant decision was made.
- [ ] You have read the diff.

### 6.7 Architecture Decision Records

Store as `docs/decisions/NNNN-title.md` using this template:

```
# NNNN. Title
Date:
Status: Proposed | Accepted | Superseded by NNNN
Context: what problem and constraints
Decision: what we chose
Alternatives considered: and why not
Consequences: good and bad
```

**Initial ADRs to write in Phase 1**

| No. | Decision |
| --- | --- |
| 0001 | React and TypeScript for the application; Rust only inside Tauri |
| 0002 | Supabase as backend, RLS as the authorisation layer |
| 0003 | Win-probability based move classification |
| 0004 | Stockfish WASM in a Web Worker behind an Engine interface |
| 0005 | Monorepo with pnpm workspaces and enforced package boundaries |
| 0006 | Manual PGN before platform sync; Lichess embedded evals as an early shortcut |
| 0007 | Licensing approach (GPL implications of Stockfish and Chessground) |
| 0008 | Threading model: single-threaded WASM vs cross-origin isolation (decide in Phase 3) |

### 6.8 Phase 1 starter backlog (hand these to the assistant in order)

1. **Repo setup.** pnpm workspace, TypeScript strict config, ESLint, Prettier, Vitest, folder skeleton for apps/web and packages/shared and packages/chess-core. Add `CLAUDE.md`, docs, CHANGELOG, `.env.example`, `.gitignore`.
2. **CI.** GitHub Actions running typecheck, lint, unit tests on pull requests; enable secret scanning.
3. **Web shell.** Vite React app, Tailwind with the design tokens from Part 4.5, light and dark theme switch, routing with the six primary screens as empty states, responsive layout with sidebar and mobile tab bar.
4. **Board.** BoardView wrapping Chessground; chess.js for legality; supports FEN in, legal moves, promotion dialog, flip, move list, keyboard stepping; unit tests for castling, en passant, four promotions, stalemate.
5. **Supabase local setup.** Supabase CLI, `profiles` migration with RLS, policy test with two users, trigger that creates a profile on sign-up.
6. **Auth.** Sign-in screen, session handling, protected routes, sign-out; public sign-up disabled.
7. **Licence register and ADRs 0001 to 0007.**
8. **Playwright smoke test.** Sign in, see the dashboard, move a piece on the board.

Phase 1 is complete when the exit criteria in Part 2.3 are demonstrated and the phase gate checklist in 2.4 is satisfied.

### 6.9 Guardrails: common ways AI-assisted builds go wrong

| Failure | Prevention |
| --- | --- |
| Invented library APIs or outdated usage | Require the assistant to check installed versions and types; pin versions |
| Silent scope creep | Every task has an Out of scope line; reject unrelated changes in review |
| Tests rewritten to pass | Review test diffs separately; domain tests are written first and reviewed by you |
| Insecure shortcuts (service key in client, RLS off to "make it work") | Security rules in CLAUDE.md, CI check for RLS, code review prompt in 6.5 |
| Over-engineering | Create folders and abstractions only when the second use appears |
| Wrong chess assumptions (side-relative scores, mate handling) | Section 6.5a rules and fixtures |
| Context drift in long sessions | One task per session; keep CLAUDE.md current |
| Building features before using the product | Phase 4 exit requires you to complete a real review session |

### 6.10 Glossary

| Term | Meaning |
| --- | --- |
| FEN | Text description of a single position |
| PGN | Text format for a game with moves and metadata |
| UCI | Protocol used to communicate with chess engines |
| MultiPV | Engine setting to return several best lines |
| Centipawn | One hundredth of a pawn, the unit of engine evaluation |
| White-relative | Positive means White is better, regardless of who is to move |
| Win percentage | Evaluation converted to a 0 to 100 chance of winning |
| Golden set | Your hand-labelled positions used to test the classifier |
| RLS | Row Level Security, database-enforced per-user access |
| ADR | Architecture Decision Record |
| Loop | Import, analyse, find mistakes, make exercises, review, measure |

### 6.11 What to do next

1. This week, before any code: complete Phase 0 (analyse 20 games per platform and record your recurring mistakes).
2. Create the GitHub repository and commit this documentation set as `docs/`.
3. Create the Supabase project and keep the free tier.
4. Start a fresh AI session, paste the Phase 1 backlog item 1 using the task template, and begin.
