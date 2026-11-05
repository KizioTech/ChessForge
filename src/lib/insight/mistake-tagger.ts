/**
 * mistake-tagger.ts — Heuristic classifier for tagging chess mistakes and blunders.
 *
 * Implements Phase 5 (Insight & Weakness Diagnosis):
 * 1. hanging_piece: Move leaves an undefended piece or places a piece on an attacked square where it is lost for insufficient compensation.
 * 2. missed_mate: The best engine line forces checkmate, but the player played a move that does not maintain mate.
 * 3. missed_fork: The engine's recommended move executes a tactical fork/double attack against 2+ undefended or valuable pieces, which the player missed.
 * 4. back_rank_weakness: Move permits or suffers from back-rank mate or major back-rank tactical threats (e.g. 1st/8th rank checkmate).
 * 5. time_trouble: Clock time remaining at move < 30 seconds (if clock data present in PGN).
 * 6. missed_tactic: Catch-all tactical blunder if significant win% loss (> 20%) but specific structural tags weren't triggered.
 */

import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import type { CandidateLine, MoveClassification } from "../engine/types";

export type MistakeTag =
  | "hanging_piece"
  | "missed_mate"
  | "missed_fork"
  | "back_rank_weakness"
  | "time_trouble"
  | "missed_tactic";

export interface MistakeTaggingInput {
  fenBefore: string;
  fenAfter: string;
  playedUci: string;
  playedSan: string;
  bestUci?: string | null;
  bestSan?: string | null;
  pvLines?: CandidateLine[];
  classification: MoveClassification;
  winPctLoss: number;
  clockRemainingSeconds?: number | null;
}

export interface MistakeTaggingResult {
  tags: MistakeTag[];
  confidence: Record<MistakeTag, number>;
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100
};

/**
 * Checks if square is defended by a given color.
 */
function isSquareDefendedBy(chess: Chess, targetSq: Square, color: Color): boolean {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const sq = piece.square;
        if (sq === targetSq) continue;
        if (piece.type === "p") {
          const fileDiff = targetSq.charCodeAt(0) - sq.charCodeAt(0);
          const rankDiff = parseInt(targetSq[1], 10) - parseInt(sq[1], 10);
          const forward = color === "w" ? 1 : -1;
          if (rankDiff === forward && Math.abs(fileDiff) === 1) {
            return true;
          }
        } else {
          // Temporarily test attacks
          // We can check legal moves or pseudolegal attacks
          // In chess.js, isAttacked checks if attacked by opponent.
        }
      }
    }
  }
  return false;
}

/**
 * Determines whether a square is attacked by color.
 * Uses chess.isAttacked (checks if square is attacked by opponent of side to move or specific color)
 */
function isSquareAttackedBy(chess: Chess, square: Square, color: Color): boolean {
  // chess.isAttacked(square, color) is available in chess.js v1.x
  try {
    return chess.isAttacked(square, color);
  } catch {
    // Fallback if not directly exposed with color param
    return false;
  }
}

/**
 * Parses clock time in seconds from PGN %clk annotation or raw string, e.g. "0:00:25", "25", "0:25".
 */
export function parseClockSeconds(clkStr: string | null | undefined): number | null {
  if (!clkStr) return null;
  const cleaned = clkStr.trim().replace(/^\[%clk\s+/, "").replace(/\]$/, "");
  const parts = cleaned.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

/**
 * Tags a mistake or blunder with tactical and positional themes.
 */
export function tagMistake(input: MistakeTaggingInput): MistakeTaggingResult {
  const tags: MistakeTag[] = [];
  const confidence: Partial<Record<MistakeTag, number>> = {};

  // Only mistakes and blunders get tagged
  if (input.classification !== "mistake" && input.classification !== "blunder") {
    return { tags: [], confidence: {} as Record<MistakeTag, number> };
  }

  const { fenBefore, fenAfter, playedUci, bestUci, pvLines, winPctLoss, clockRemainingSeconds } = input;

  // 1. Time Trouble: Clock < 30 seconds
  if (clockRemainingSeconds != null && clockRemainingSeconds < 30) {
    tags.push("time_trouble");
    confidence.time_trouble = clockRemainingSeconds <= 10 ? 0.95 : 0.85;
  }

  const chessBefore = new Chess(fenBefore);
  const playerColor = chessBefore.turn();
  const opponentColor: Color = playerColor === "w" ? "b" : "w";

  const chessAfter = new Chess(fenAfter);

  // 2. Missed Mate:
  // If the engine's best line in fenBefore indicated a forced checkmate for player (mateIn > 0),
  // but after the played move either it's no longer mate or player is getting mated.
  const bestLine = pvLines && pvLines.length > 0 ? pvLines[0] : null;
  const hadMateInPV = bestLine && bestLine.mateIn !== null && (
    (playerColor === "w" && bestLine.mateIn > 0) ||
    (playerColor === "b" && bestLine.mateIn < 0)
  );

  if (hadMateInPV) {
    // Check if played move ended in mate anyway
    if (!chessAfter.isCheckmate()) {
      tags.push("missed_mate");
      confidence.missed_mate = 0.95;
    }
  }

  // 3. Back-Rank Weakness:
  // Triggered if either:
  // a) Opponent now has a back-rank mate or check threat on rank 1 (for white) or rank 8 (for black)
  // b) The position results in mate on 1st/8th rank by rook/queen
  const backRank = playerColor === "w" ? "1" : "8";
  const opponentBackRank = opponentColor === "w" ? "1" : "8";

  let isBackRank = false;
  if (chessAfter.isCheckmate()) {
    // Player got checkmated right away on back rank
    const kingSquare = findKingSquare(chessAfter, playerColor);
    if (kingSquare && kingSquare[1] === backRank) {
      isBackRank = true;
    }
  } else {
    // Check if opponent's winning reply or top moves target back rank with Rook/Queen
    const opponentMoves = chessAfter.moves({ verbose: true });
    for (const m of opponentMoves) {
      if ((m.piece === "r" || m.piece === "q") && m.to[1] === backRank) {
        // Does this give check or mate?
        const testGame = new Chess(fenAfter);
        testGame.move(m);
        if (testGame.isCheckmate() || (testGame.inCheck() && winPctLoss > 30)) {
          isBackRank = true;
          break;
        }
      }
    }
  }

  if (isBackRank) {
    tags.push("back_rank_weakness");
    confidence.back_rank_weakness = 0.9;
  }

  // 4. Missed Fork:
  // Best move would have attacked 2 or more opponent pieces of value (or King + piece),
  // while the played move did not.
  if (bestUci && bestUci.length >= 4) {
    const bestFrom = bestUci.substring(0, 2) as Square;
    const bestTo = bestUci.substring(2, 4) as Square;
    const movingPiece = chessBefore.get(bestFrom);

    if (movingPiece && movingPiece.type !== "k") {
      const testBestChess = new Chess(fenBefore);
      try {
        testBestChess.move({ from: bestFrom, to: bestTo, promotion: bestUci[4] as any });
        const targets = findAttackedValuableTargets(testBestChess, bestTo, opponentColor);
        if (targets.length >= 2) {
          tags.push("missed_fork");
          confidence.missed_fork = 0.85;
        }
      } catch {
        // Move parse error ignore
      }
    }
  }

  // 5. Hanging Piece:
  // Did the player leave one of their pieces attacked and undefended (or move into an attacked square)?
  // Or did the player fail to protect an attacked piece that opponent can now capture for free?
  if (playedUci && playedUci.length >= 4) {
    const toSq = playedUci.substring(2, 4) as Square;
    const pieceMoved = chessAfter.get(toSq);

    let isHanging = false;
    if (pieceMoved && pieceMoved.type !== "k") {
      // Piece moved into an attacked square without adequate defense
      const isAttacked = isSquareAttackedBy(chessAfter, toSq, opponentColor);
      const isDefended = isSquareAttackedBy(chessAfter, toSq, playerColor);
      const pieceVal = PIECE_VALUES[pieceMoved.type];

      if (isAttacked && !isDefended && pieceVal >= 3) {
        isHanging = true;
      }
    }

    // Also check if an existing piece was left hanging (opponent has captures with positive material balance)
    if (!isHanging) {
      const opponentCaptures = chessAfter.moves({ verbose: true }).filter(m => m.captured);
      for (const cap of opponentCaptures) {
        const capturedVal = PIECE_VALUES[cap.captured!];
        const attackingVal = PIECE_VALUES[cap.piece];
        const capSq = cap.to;
        const defended = isSquareAttackedBy(chessAfter, capSq, playerColor);

        // Captured free piece or higher value piece
        if (!defended && capturedVal >= 3) {
          isHanging = true;
          break;
        } else if (defended && capturedVal - attackingVal >= 2) {
          isHanging = true;
          break;
        }
      }
    }

    if (isHanging && winPctLoss >= 15) {
      tags.push("hanging_piece");
      confidence.hanging_piece = 0.88;
    }
  }

  // 6. Missed Tactic (Catch-all):
  // If large loss (> 20 win prob points) and none of the specific tactical tags applied
  if (
    tags.filter(t => t !== "time_trouble").length === 0 &&
    winPctLoss >= 20
  ) {
    tags.push("missed_tactic");
    confidence.missed_tactic = 0.75;
  }

  return {
    tags,
    confidence: confidence as Record<MistakeTag, number>
  };
}

function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) {
        return p.square;
      }
    }
  }
  return null;
}

/**
 * Finds opponent pieces attacked by a piece on a specific square.
 */
function findAttackedValuableTargets(chess: Chess, fromSq: Square, opponentColor: Color): Square[] {
  const attackedTargets: Square[] = [];
  const piece = chess.get(fromSq);
  if (!piece) return attackedTargets;

  // Check if current position gives check to opponent king
  if (chess.inCheck()) {
    const oppKing = findKingSquare(chess, opponentColor);
    if (oppKing && !attackedTargets.includes(oppKing)) {
      attackedTargets.push(oppKing);
    }
  }

  // Next, find which opponent pieces are directly attacked by piece on fromSq
  // In chess.js, check attacks by this piece:
  // We can see if square is attacked by fromSq or check piece's moves if it were its turn
  const testTurn = new Chess(chess.fen());
  // Set turn to the piece's color to get its attacks
  const tokens = chess.fen().split(" ");
  tokens[1] = piece.color;
  tokens[3] = "-"; // clear en passant to avoid edge cases
  try {
    testTurn.load(tokens.join(" "));
    const moves = testTurn.moves({ square: fromSq, verbose: true });
    for (const m of moves) {
      if (m.captured) {
        const capVal = PIECE_VALUES[m.captured];
        if (capVal >= 1 && !attackedTargets.includes(m.to)) {
          attackedTargets.push(m.to);
        }
      }
    }
  } catch {
    // fallback
  }

  return attackedTargets;
}
