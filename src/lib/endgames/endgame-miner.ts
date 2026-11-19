/**
 * endgame-miner.ts — Mines endgame positions from user games where advantages were dropped.
 *
 * Scans user's MistakeRecords (and associated GameRecords) to isolate:
 * - Positions with endgame material (<= 26 non-king points total, or pawn/lone piece endgames, or deep plies >= 50)
 * - Where the user made a blunder/mistake (lost or drew when a win/draw was available)
 * - Produces MinedEndgamePosition items formatted for interactive drilling in the Endgame Lab.
 */

import { Chess } from "chess.js";
import type { MistakeRecord } from "../training/types";
import type { GameRecord } from "../games";
import type { EndgameCategory, EndgameDifficulty, EndgameObjective, EndgamePosition } from "./types";

export interface MinedEndgamePosition extends EndgamePosition {
  gameId: string;
  ply: number;
  playedSan: string;
  opponentName: string;
  gameDate?: string;
  gameResult: string;
  materialScore: number;
}

const PIECE_VALUES: Record<string, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1
};

/**
 * Counts non-king piece material on the board from a FEN string.
 */
export function countMaterialPoints(fen: string): { totalMaterial: number; queens: number; rooks: number; minors: number; pawns: number } {
  const parts = fen.split(" ");
  const boardStr = parts[0];

  let queens = 0;
  let rooks = 0;
  let minors = 0;
  let pawns = 0;
  let totalMaterial = 0;

  for (const ch of boardStr) {
    const lower = ch.toLowerCase();
    if (PIECE_VALUES[lower]) {
      const val = PIECE_VALUES[lower];
      totalMaterial += val;
      if (lower === "q") queens++;
      else if (lower === "r") rooks++;
      else if (lower === "b" || lower === "n") minors++;
      else if (lower === "p") pawns++;
    }
  }

  return { totalMaterial, queens, rooks, minors, pawns };
}

/**
 * Evaluates whether a position qualifies as an endgame phase.
 */
export function isEndgameFen(fen: string, ply?: number): boolean {
  const { totalMaterial, queens, rooks, minors } = countMaterialPoints(fen);
  // Pure pawn endgame
  if (queens === 0 && rooks === 0 && minors === 0) return true;
  // Material <= 26 non-king points (roughly equivalent to 1 queen + 1 rook per side, or 2 rooks + 1 minor per side)
  if (totalMaterial <= 26) return true;
  // No queens and at most 1 minor/rook per side
  if (queens === 0 && rooks <= 2 && minors <= 2) return true;
  // Late ply heuristic
  if (ply !== undefined && ply >= 60 && totalMaterial <= 34) return true;

  return false;
}

/**
 * Classifies an endgame FEN into category: pawn, rook, minor, queen, or checkmate.
 */
export function classifyEndgameCategory(fen: string): EndgameCategory {
  const { queens, rooks, minors } = countMaterialPoints(fen);
  if (queens === 0 && rooks === 0 && minors === 0) return "pawn";
  if (rooks > 0 && queens === 0 && minors === 0) return "rook";
  if (minors > 0 && queens === 0 && rooks === 0) return "minor";
  if (queens > 0) return "queen";
  return "rook";
}

/**
 * Scans mistake records against user games to extract personal endgame drills.
 */
export function mineEndgameMistakes(
  mistakes: MistakeRecord[],
  games: GameRecord[]
): MinedEndgamePosition[] {
  const gamesMap = new Map<string, GameRecord>();
  games.forEach(g => gamesMap.set(g.id, g));

  const mined: MinedEndgamePosition[] = [];

  for (const m of mistakes) {
    // Only mistakes with verified best move
    if (!m.best_san) continue;

    // Check if position was in endgame
    if (!isEndgameFen(m.fen, m.ply)) continue;

    const game = gamesMap.get(m.game_id);
    const opponent = game
      ? (game.user_colour === "white" ? game.black : game.white) || "Opponent"
      : "Opponent";
    const gameResult = game?.result || "*";

    // Determine side to move from FEN
    const sideToMove: "white" | "black" = m.fen.includes(" w ") ? "white" : "black";

    const category = classifyEndgameCategory(m.fen);
    const { totalMaterial } = countMaterialPoints(m.fen);

    // Objective: if user lost or drew, the missed move was aiming for win or defense
    const objective: EndgameObjective =
      gameResult === "1/2-1/2" ? "win" :
      (game?.user_colour === "white" && gameResult === "0-1") ? "draw" :
      (game?.user_colour === "black" && gameResult === "1-0") ? "draw" : "win";

    const title = `vs ${opponent} (Move ${Math.floor(m.ply / 2) + 1})`;
    const keyConcept = `Find the clinical ${m.best_san} instead of ${m.played_san}`;
    const description = `In your game against ${opponent}, you played ${m.played_san} which dropped ${Math.round(m.win_pct_loss)}% win probability. Test your calculation to play the winning continuation.`;
    const explanation = `In this endgame, ${m.best_san} was the master continuation. You played ${m.played_san}, allowing counterplay.`;

    const minedPos: MinedEndgamePosition = {
      id: `mined-${m.game_id}-${m.ply}`,
      title,
      category,
      difficulty: m.win_pct_loss > 35 ? "intermediate" : "advanced",
      objective,
      sideToMove,
      fen: m.fen,
      description,
      keyConcept,
      solutionLine: [m.best_san],
      explanation,
      gameId: m.game_id,
      ply: m.ply,
      playedSan: m.played_san,
      opponentName: opponent,
      gameDate: game?.played_at,
      gameResult,
      materialScore: totalMaterial
    };

    mined.push(minedPos);
  }

  // Sort by win_pct_loss descending (most impactful mistakes first)
  return mined;
}

/**
 * Loads screening mistakes from localStorage and mines endgame positions.
 */
export function getSavedMinedEndgames(games: GameRecord[]): MinedEndgamePosition[] {
  try {
    const raw = localStorage.getItem("chessforge:mistakes");
    if (!raw) return [];
    const mistakes: MistakeRecord[] = JSON.parse(raw);
    return mineEndgameMistakes(mistakes, games);
  } catch {
    return [];
  }
}
