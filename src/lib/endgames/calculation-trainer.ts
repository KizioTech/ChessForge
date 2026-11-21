/**
 * calculation-trainer.ts
 *
 * Core logic for Phase 8 Calculation & Blindfold Memory Drills:
 * - Unseen move stepping and target FEN derivation
 * - Solution validation against visualized mental positions
 * - Move sequence formatting with standard chess move numbers
 * - Board coordinate reflex trainer utilities
 * - Local progress tracking for calculation drills
 */

import { Chess, type Square } from "chess.js";
import type {
  CalculationDrill,
  CalculationAttemptResult,
  BlindfoldPieceMode
} from "./types";

const CALCULATION_STATS_STORAGE_KEY = "chessforge:calculation-stats";

export interface CalculationDrillProgress {
  solved: boolean;
  attempts: number;
  lastTrainedAt?: string;
}

export type CalculationStatsMap = Record<string, CalculationDrillProgress>;

/**
 * Calculates the resulting FEN after applying a sequence of unseen moves to an initial FEN.
 */
export function getCalculatedFen(
  initialFen: string,
  moves: string[]
): { success: boolean; fen: string; error?: string; pliesPlayed: number } {
  let pliesPlayed = 0;
  try {
    const chess = new Chess(initialFen);

    for (const move of moves) {
      const cleanMove = move.trim();
      if (!cleanMove) continue;

      try {
        const res = chess.move(cleanMove);
        if (!res) {
          return {
            success: false,
            fen: chess.fen(),
            error: `Illegal or ambiguous move "${cleanMove}" at ply ${pliesPlayed + 1}`,
            pliesPlayed
          };
        }
      } catch (moveErr) {
        return {
          success: false,
          fen: chess.fen(),
          error: `Illegal move "${cleanMove}" at ply ${pliesPlayed + 1}: ${moveErr instanceof Error ? moveErr.message : String(moveErr)}`,
          pliesPlayed
        };
      }

      pliesPlayed++;
    }

    return {
      success: true,
      fen: chess.fen(),
      pliesPlayed
    };
  } catch (err) {
    return {
      success: false,
      fen: initialFen,
      error: err instanceof Error ? err.message : String(err),
      pliesPlayed
    };
  }
}

/**
 * Formats a raw list of moves into conventional numbered notation (e.g. ["1. e4", "1... e5", "2. Nf3"]).
 */
export function formatUnseenMoves(initialFen: string, moves: string[]): string[] {
  try {
    const chess = new Chess(initialFen);
    const tokens = initialFen.trim().split(/\s+/);
    let fullmoveNumber = parseInt(tokens[5] || "1", 10);
    if (isNaN(fullmoveNumber) || fullmoveNumber < 1) fullmoveNumber = 1;

    const formatted: string[] = [];

    for (const move of moves) {
      const isWhite = chess.turn() === "w";
      const currentNum = fullmoveNumber;

      try {
        const res = chess.move(move);
        if (!res) {
          formatted.push(`${isWhite ? `${currentNum}. ` : `${currentNum}... `}${move}`);
          break;
        }

        if (isWhite) {
          formatted.push(`${currentNum}. ${res.san}`);
        } else {
          formatted.push(`${currentNum}... ${res.san}`);
          fullmoveNumber++;
        }
      } catch {
        formatted.push(`${isWhite ? `${currentNum}. ` : `${currentNum}... `}${move}`);
        break;
      }
    }

    return formatted;
  } catch {
    return moves;
  }
}

/**
 * Normalizes a SAN move by stripping evaluation glyphs (!, ?, #, +) and whitespace for robust comparison.
 */
export function normalizeSan(san: string): string {
  return san.replace(/[!?+#]/g, "").trim();
}

/**
 * Validates a user's proposed solution against the drill's solution and acceptable alternatives.
 * Handles both SAN notation (e.g. "Kf4", "a8=Q") and UCI/coordinate moves (e.g. "e5f4", "a7a8q").
 */
export function validateCalculationSolution(
  drill: CalculationDrill,
  userMoveInput: string
): CalculationAttemptResult {
  const targetResult = getCalculatedFen(drill.initialFen, drill.unseenMoves);
  const targetFen = targetResult.fen;

  const chess = new Chess(targetFen);
  const rawInput = userMoveInput.trim();

  let playedSan = rawInput;

  // Try parsing user move on the target position (in case it was passed as UCI from board interaction)
  try {
    const moveRes = chess.move(rawInput);
    if (moveRes) {
      playedSan = moveRes.san;
    }
  } catch {
    // If chess.move throws, user might have passed plain text or an illegal move
  }

  const normalizedPlayed = normalizeSan(playedSan);
  const normalizedExpected = normalizeSan(drill.solutionMove);

  const isExactMatch = normalizedPlayed === normalizedExpected;
  const isAlternativeMatch = (drill.alternativeSolutions || []).some(
    alt => normalizeSan(alt) === normalizedPlayed
  );

  const correct = isExactMatch || isAlternativeMatch;

  return {
    correct,
    playedMove: playedSan,
    expectedMove: drill.solutionMove,
    explanation: drill.explanation,
    targetFen
  };
}

/* -------------------------------------------------------------------------- */
/* Board Coordinate Reflex Trainer                                            */
/* -------------------------------------------------------------------------- */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export const ALL_SQUARES: Square[] = FILES.flatMap(f =>
  RANKS.map(r => `${f}${r}` as Square)
);

/**
 * Generates a random board square (e.g. "e4", "c7").
 */
export function generateRandomSquare(): Square {
  const index = Math.floor(Math.random() * ALL_SQUARES.length);
  return ALL_SQUARES[index];
}

/**
 * Generates a random square avoiding a list of excluded squares (e.g. the last square).
 */
export function getRandomSquareExcluding(excludeSquares: string[]): Square {
  const candidates = ALL_SQUARES.filter(s => !excludeSquares.includes(s));
  if (candidates.length === 0) return generateRandomSquare();
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Verifies if the clicked square matches the target square.
 */
export function checkSquareMatch(clickedSquare: string, targetSquare: string): boolean {
  return clickedSquare.toLowerCase().trim() === targetSquare.toLowerCase().trim();
}

/* -------------------------------------------------------------------------- */
/* Progress Persistence                                                       */
/* -------------------------------------------------------------------------- */

export function loadCalculationStats(): CalculationStatsMap {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(CALCULATION_STATS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CalculationStatsMap;
  } catch {
    return {};
  }
}

export function recordCalculationAttempt(
  drillId: string,
  success: boolean
): CalculationStatsMap {
  const current = loadCalculationStats();
  const prev = current[drillId] || { solved: false, attempts: 0 };

  const updated: CalculationStatsMap = {
    ...current,
    [drillId]: {
      solved: prev.solved || success,
      attempts: prev.attempts + 1,
      lastTrainedAt: new Date().toISOString()
    }
  };

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CALCULATION_STATS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Graceful fallback if storage is restricted
  }

  return updated;
}
