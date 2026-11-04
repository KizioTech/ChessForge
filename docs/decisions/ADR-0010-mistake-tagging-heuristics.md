# ADR 0010: Heuristic Mistake Tagging and Weakness Diagnosis

## Status
Accepted

## Context
In Phase 4, the application delivered the core training loop by identifying mistakes and blunders via win-probability loss (ADR 0003) and generating training exercises. However, to provide users with actionable diagnosis of their recurring errors (Phase 5), the system needs to categorize mistakes into intelligible tactical and structural themes:
- `hanging_piece`
- `missed_mate`
- `missed_fork`
- `back_rank_weakness`
- `time_trouble`
- `missed_tactic` (catch-all)

Furthermore, Core Principle #3 dictates "Evidence Over Assumptions": longitudinal performance and weakness trends require a minimum baseline sample size (N >= 20 games) before diagnostic metrics are considered statistically meaningful.

## Decision
1. **Deterministic Heuristic Tagger (`mistake-tagger.ts`)**:
   - Executes during analysis / exercise generation when move classification is `mistake` or `blunder`.
   - Uses `chess.js` board queries and engine candidate PV lines to detect:
     - Undefended hanging pieces or attacks against undefended higher-value pieces.
     - Missed forced mate sequences from the engine PV.
     - Tactical double-attacks/forks against multiple valuable targets or king+piece.
     - Back-rank vulnerabilities on rank 1 (White) or rank 8 (Black).
     - Clock pressure under 30 seconds (`%clk` annotations).
   - Generates tags alongside confidence levels (0.0 to 1.0) stored in `mistakes.tags` and `mistakes.tag_confidence`.

2. **Longitudinal Trend Service (`trend-service.ts`)**:
   - Enforces the `N >= 20` games baseline guard (`insufficientData: true` when fewer than 20 games exist).
   - Calculates blunders per 100 moves across rolling 10-game windows.
   - Computes breakdown of tactical blindspots and time-trouble rates.

3. **Analytics Dashboard (`AnalyticsView.tsx`)**:
   - Displays tactical blindspot radar, time-trouble vulnerability gauge, and rolling blunder sparklines.
   - Prominently displays the preliminary warning banner whenever `totalGames < 20`.

## Consequences
- Fast client-side evaluation without requiring external ML models or server round-trips.
- Consistent with offline-first architecture (dual-layer Supabase + LocalStorage).
- Users receive clear feedback on recurring patterns rather than unclassified errors.
