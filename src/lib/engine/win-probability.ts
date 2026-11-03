/**
 * win-probability.ts — Implements ADR 0003 (Win-Probability Based Move Classification).
 *
 * Win probability formula:
 * winPct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 *
 * All evaluations are calculated from White's perspective, then converted to the
 * moving player's perspective to measure move loss:
 * loss = winPct(before) - winPct(after)
 */
import type { MoveClassification } from "./types";

const EXP_COEFFICIENT = -0.00368208;

/**
 * Calculates win probability (0.0 to 100.0) from White's perspective
 * given a White-relative centipawn score or forced mate distance.
 */
export function calculateWinProbability(
  scoreCp: number | null,
  mateIn: number | null
): number {
  if (mateIn !== null) {
    if (mateIn > 0) return 100.0;
    if (mateIn < 0) return 0.0;
    return 50.0;
  }

  if (scoreCp === null || isNaN(scoreCp)) {
    return 50.0;
  }

  // Clamped at realistic extremes to avoid overflow
  const clampedCp = Math.max(-2000, Math.min(2000, scoreCp));
  const expVal = Math.exp(EXP_COEFFICIENT * clampedCp);
  const prob = 50 + 50 * (2 / (1 + expVal) - 1);

  // Round to 1 decimal place and clamp [0, 100]
  return Math.max(0, Math.min(100, Math.round(prob * 10) / 10));
}

/**
 * Converts a White-relative win probability (0..100) to the mover's perspective.
 */
export function getMoverWinProbability(
  whiteWinProb: number,
  mover: "white" | "black"
): number {
  return mover === "white" ? whiteWinProb : Math.round((100 - whiteWinProb) * 10) / 10;
}

/**
 * Classifies move loss into standard ADR 0003 tiers:
 * - Best: loss < 1 (or isBestMove)
 * - Good: loss < 5
 * - Inaccuracy: 5 <= loss < 10
 * - Mistake: 10 <= loss < 20
 * - Blunder: loss >= 20
 */
export function classifyMove(loss: number, isBestMove = false): MoveClassification {
  if (isBestMove || loss < 1.0) return "best";
  if (loss < 5.0) return "good";
  if (loss < 10.0) return "inaccuracy";
  if (loss < 20.0) return "mistake";
  return "blunder";
}

