# 0003. Win-Probability Based Move Classification

- **Date:** 2026-11-03
- **Status:** Accepted

## Context
Traditional chess tools classify moves based on raw centipawn loss. However, a 200 centipawn swing in an equal position (+0.2 to -1.8) fundamentally transforms the game outcome, whereas a 200 centipawn swing in an already completely winning position (+9.0 to +7.0) retains a 99% win probability.

## Decision
We classify moves using win-probability loss from the moving player's perspective:
`winPct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`
Mate for mover maps to 100%; mate against mover maps to 0%.

Move loss: `loss = winPct(before) - winPct(after)`.
Thresholds (configured in `shared/config`):
- Best: loss < 1 (or rank 1)
- Good: loss < 5
- Inaccuracy: 5 to < 10
- Mistake: 10 to < 20
- Blunder: >= 20

## Consequences
- **Positive:** Exercises are generated from genuine turning points in games rather than irrelevant swings in already-decided positions.
- **Negative:** Non-linear formula requires testing edge cases (mate transitions, stalemate/drawn positions evaluating to 0).

