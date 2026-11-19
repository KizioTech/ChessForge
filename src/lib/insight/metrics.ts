/**
 * metrics.ts — Pure calculation of chess performance metrics.
 */

import type { MoveAnalysisReport } from "../engine/types";

/**
 * Calculates blunders per 100 moves played by the user.
 * Returns null if the user has played fewer than minimumMoves (default 100),
 * indicating not enough sample evidence.
 */
export function blundersPer100Moves(
  reports: Pick<MoveAnalysisReport, "mover" | "classification">[],
  userColour: "white" | "black",
  minimumMoves: number = 100
): number | null {
  const userMoves = reports.filter(r => r.mover === userColour);
  if (userMoves.length < minimumMoves) {
    return null;
  }
  const blunders = userMoves.filter(r => r.classification === "blunder").length;
  return Math.round((blunders / userMoves.length) * 1000) / 10;
}
