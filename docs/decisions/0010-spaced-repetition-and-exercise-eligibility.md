# ADR 0010 — Spaced Repetition (Modified SM-2) and Exercise Eligibility Engine

**Status:** Accepted  
**Date:** 2026-11-03  
**Deciders:** ChessForge core team

---

## Context

Phase 4 completes "The Loop" — the core value proposition of ChessForge:
1. Import games from online platforms (Chess.com, Lichess) or PGN.
2. Analyze them with Stockfish 16 WASM to identify recurring tactical/positional mistakes.
3. Automatically generate personal training exercises from eligible mistakes.
4. Schedule daily deliberate practice using an adaptive spaced repetition algorithm (modified SM-2).
5. Track mastery and provide full user data sovereignty via PGN and JSON exports.

---

## Decision

### 1. Exercise Eligibility Rules (Section 3.7)

Not every mistake makes a sound exercise. To prevent noisy, ambiguous, or trivial puzzles, an engine-evaluated ply must meet strict eligibility constraints:

1. **User Mover Check:** The side to move must match `game.user_colour`. Opponent blunders are not converted into user exercises.
2. **Loss Threshold:** Classification must be `mistake` (loss > 5%) or `blunder` (loss > 10%). `inaccuracy` is stored in the `mistakes` table for weakness diagnostics but excluded from the active solving queue.
3. **Decided Position Filter:** The position before the move must have a mover win probability between 10% and 90%. Completely lost or dead-won positions are rejected.
4. **Task Clarity (Single vs Multi-solution):**
   - *Single solution:* The best candidate line beats the second-best line by $\ge 8\%$ win probability.
   - *Multi-solution:* All candidate lines within 3% win probability of the best move are accepted as valid solutions.
5. **Cap per Game:** At most 3 exercises per game, prioritized by highest win-probability loss.
6. **FEN Deduplication:** Positions identical by FEN are not duplicated across games.

### 2. Modified SM-2 Scheduler (Section 3.8)

State stored per exercise in `review_schedule`:
- `repetitions`: count of successful reviews
- `ease_factor`: start 2.50, min 1.30
- `interval_days`: interval in days until next review (capped at 60 days)
- `due_at`: timestamp of next review
- `lapses`: count of failed attempts

Grades:
- **Again:** Failed attempt or gave up. `repetitions = 0`, `lapses += 1`, `ease -= 0.20`, scheduled for `now + 10 minutes`.
- **Hard:** Correct but used hints or slow calculation (> 2x median). `interval = max(1, interval * 1.2)`, `ease -= 0.15`.
- **Good:** Correct, no hint, standard time. Rep 1 = 1 day, Rep 2 = 3 days, Rep 3+ = `round(interval * ease)`.
- **Easy:** Fast, confident solution. `interval = round(interval * ease * 1.3)`, `ease += 0.15`.

**Mastery Rule:** 5 consecutive `Good` or `Easy` attempts mark the exercise `mastered`, removing it from the active review queue.

### 3. "Bad Exercise" Human Override

Every exercise in `<TrainingDesk>` includes a "Bad exercise" button. Flagging immediately retires the exercise from the active queue and logs a user-provided reason (e.g., "Multiple equally good moves", "Unrealistic position") to refine generator heuristics.

### 4. Data Sovereignty & Export (FR-112)

Users retain 100% data sovereignty:
- `exportGamesToPgn(games)`: Concatenates all library games into standard multi-game PGN format.
- `exportAllDataAsJson(games)`: Complete client backup containing games, mistakes, exercises, review schedules, and attempt histories.

---

## Consequences

- **Positive:** Completes R1 milestone. The user has an end-to-end autonomous training loop without external server dependency.
- **Positive:** Strict eligibility rules eliminate low-quality puzzle generation from complex engine lines.
- **Positive:** Offline and unauthenticated guests can train smoothly via LocalStorage mirroring.
- **Traceability:** Full attempt history allows future statistical weakness modeling (Phase 5).

