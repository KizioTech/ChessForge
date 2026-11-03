/**
 * uci-parser.ts — UCI output parsing and White-relative normalization.
 *
 * Implements ADR 0004 requirement:
 * "Evaluations are normalized to White-relative scores immediately upon UCI string parsing
 * before reaching any application code."
 */
import { Chess } from "chess.js";
import type { CandidateLine, PositionEvaluation } from "./types";
import { calculateWinProbability } from "./win-probability";

export interface ParsedUciInfo {
  depth: number;
  multiPv: number;
  scoreCp: number | null; // Normalized to White-relative
  mateIn: number | null; // Normalized to White-relative
  pv: string[];
}

/**
 * Parses an `info ...` line from a UCI engine.
 *
 * @param line UCI output line (e.g. `info depth 16 seldepth 20 multipv 1 score cp 35 pv e2e4 e7e5`)
 * @param sideToMove Side to move in the analyzed position ('w' or 'b')
 */
export function parseUciInfoLine(line: string, sideToMove: "w" | "b"): ParsedUciInfo | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) {
    return null;
  }

  const tokens = line.trim().split(/\s+/);

  // Depth
  const depthIdx = tokens.indexOf("depth");
  const depth = depthIdx !== -1 ? parseInt(tokens[depthIdx + 1], 10) : 0;

  // MultiPV rank (default 1 if not present)
  const mpvIdx = tokens.indexOf("multipv");
  const multiPv = mpvIdx !== -1 ? parseInt(tokens[mpvIdx + 1], 10) : 1;

  // Score
  let scoreCp: number | null = null;
  let mateIn: number | null = null;

  const scoreIdx = tokens.indexOf("score");
  if (scoreIdx !== -1 && scoreIdx + 2 < tokens.length) {
    const scoreType = tokens[scoreIdx + 1];
    const scoreVal = parseInt(tokens[scoreIdx + 2], 10);

    if (scoreType === "cp") {
      // UCI reports score from the perspective of the side to move
      scoreCp = sideToMove === "w" ? scoreVal : -scoreVal;
    } else if (scoreType === "mate") {
      mateIn = sideToMove === "w" ? scoreVal : -scoreVal;
    }
  }

  // Principal variation (pv)
  const pvIdx = tokens.indexOf("pv");
  const pv = pvIdx !== -1 ? tokens.slice(pvIdx + 1) : [];

  return {
    depth,
    multiPv,
    scoreCp,
    mateIn,
    pv
  };
}

/**
 * Converts a UCI move (e.g. "e2e4", "e7e8q") into standard algebraic notation (SAN)
 * using chess.js at the given FEN.
 */
export function uciToSan(fen: string, uciMove: string): string {
  if (!uciMove || uciMove.length < 4) return uciMove;
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4].toLowerCase() : undefined;
    const move = chess.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined
    });
    return move ? move.san : uciMove;
  } catch {
    return uciMove;
  }
}

/**
 * Builds a complete PositionEvaluation from accumulated UCI candidate lines and a bestmove string.
 */
export function buildPositionEvaluation(
  ply: number,
  fen: string,
  candidateLines: Map<number, ParsedUciInfo>,
  bestMoveUci: string,
  moveSan?: string,
  moveUci?: string
): PositionEvaluation {
  const sortedLines = Array.from(candidateLines.values()).sort(
    (a, b) => a.multiPv - b.multiPv
  );

  const top = sortedLines[0] || {
    depth: 0,
    scoreCp: 0,
    mateIn: null,
    pv: bestMoveUci ? [bestMoveUci] : []
  };

  const lines: CandidateLine[] = sortedLines.map(line => {
    const primaryUci = line.pv[0] || "";
    return {
      rank: line.multiPv,
      scoreCp: line.scoreCp,
      mateIn: line.mateIn,
      uci: primaryUci,
      san: primaryUci ? uciToSan(fen, primaryUci) : undefined,
      pv: line.pv
    };
  });

  const bestMove = bestMoveUci || top.pv[0] || "";
  const bestMoveSan = bestMove ? uciToSan(fen, bestMove) : undefined;
  const winProbability = calculateWinProbability(top.scoreCp, top.mateIn);

  return {
    ply,
    fen,
    depth: top.depth,
    scoreCp: top.scoreCp,
    mateIn: top.mateIn,
    winProbability,
    bestMoveUci: bestMove,
    bestMoveSan,
    lines,
    moveSan,
    moveUci
  };
}

