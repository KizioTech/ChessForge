/**
 * heuristic-engine.ts — Deterministic heuristic engine for unit and integration testing.
 *
 * For test environments (Node.js/Vitest) where Web Workers and WASM are unavailable.
 * Never used in production analysis or live review to ensure training integrity.
 */
import { Chess } from "chess.js";
import type {
  Engine,
  PositionEvaluation,
  CandidateLine
} from "./types";
import { calculateWinProbability } from "./win-probability";

export class HeuristicEngine implements Engine {
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  async evaluatePosition(
    fen: string,
    options?: {
      depth?: number;
      multiPv?: number;
      signal?: AbortSignal;
      ply?: number;
      moveSan?: string;
      moveUci?: string;
    }
  ): Promise<PositionEvaluation> {
    if (options?.signal?.aborted) {
      throw new DOMException("Evaluation aborted", "AbortError");
    }

    const ply = options?.ply ?? 0;
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });

    const pieceVals: Record<string, number> = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 0
    };

    let materialWhite = 0;
    let materialBlack = 0;
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const val = pieceVals[piece.type] || 0;
          if (piece.color === "w") materialWhite += val;
          else materialBlack += val;
        }
      }
    }

    let scoreCp = materialWhite - materialBlack;
    let mateIn: number | null = null;

    if (chess.isCheckmate()) {
      mateIn = chess.turn() === "w" ? -1 : 1;
      scoreCp = chess.turn() === "w" ? -30000 : 30000;
    } else if (chess.isDraw() || chess.isStalemate()) {
      scoreCp = 0;
    }

    const bestMove = moves[0];
    const bestMoveUci = bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ""}` : "";
    const bestMoveSan = bestMove?.san || "";

    const lines: CandidateLine[] = moves.slice(0, 3).map((m, idx) => {
      const lineScore = mateIn !== null ? mateIn : scoreCp - idx * 25;
      const uci = `${m.from}${m.to}${m.promotion || ""}`;
      return {
        rank: idx + 1,
        scoreCp: lineScore,
        mateIn,
        uci,
        san: m.san,
        pv: [uci],
        pvSan: m.san
      };
    });

    const winProbability = calculateWinProbability(scoreCp, mateIn);

    return {
      ply,
      fen,
      depth: options?.depth ?? 12,
      scoreCp,
      mateIn,
      winProbability,
      bestMoveUci,
      bestMoveSan,
      lines,
      moveSan: options?.moveSan,
      moveUci: options?.moveUci
    };
  }

  async stop(): Promise<void> {
    // No-op for synchronous mock
  }

  async dispose(): Promise<void> {
    this.isInitialized = false;
  }
}

