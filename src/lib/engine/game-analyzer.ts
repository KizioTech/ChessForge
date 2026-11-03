/**
 * game-analyzer.ts — Game analysis pipeline sequencing through plies.
 *
 * Implements:
 * 1. Sequential ply evaluation with progress callback (0..100%).
 * 2. Graceful cancellation via AbortSignal without corrupting database state.
 * 3. Move classification (Best, Good, Inaccuracy, Mistake, Blunder) via ADR 0003.
 * 4. Dual-layer storage (Supabase + LocalStorage fallback).
 */
import { Chess } from "chess.js";
import type { GameRecord } from "../games";
import type {
  PositionEvaluation,
  MoveAnalysisReport,
  PositionRecord,
  CandidateLine
} from "./types";
import { StockfishEngine } from "./stockfish-engine";
import { getMoverWinProbability, classifyMove } from "./win-probability";
import { saveAnalysis, type FullGameAnalysis } from "../analyses";

export interface AnalysisProgress {
  currentPly: number;
  totalPlies: number;
  percent: number;
  evaluation?: PositionEvaluation;
}

export interface AnalyzeGameOptions {
  depth?: number;
  multiPv?: number;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
}

/**
 * Replays all moves from a game's PGN and produces a full move-by-move evaluation report.
 */
export async function analyzeGame(
  game: GameRecord,
  options?: AnalyzeGameOptions
): Promise<FullGameAnalysis> {
  const depth = options?.depth ?? 16;
  const multiPv = options?.multiPv ?? 3;
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  // 1. Replay game with chess.js to collect positions and moves at each ply
  const chess = new Chess(game.start_fen || undefined);
  chess.loadPgn(game.pgn, { strict: false });
  const verboseMoves = chess.history({ verbose: true });

  // Reset to replay step-by-step
  const replayChess = new Chess(game.start_fen || undefined);

  interface PlySnapshot {
    ply: number;
    fen: string;
    moveSan?: string;
    moveUci?: string;
    mover?: "white" | "black";
  }

  const plies: PlySnapshot[] = [
    {
      ply: 0,
      fen: replayChess.fen()
    }
  ];

  for (let i = 0; i < verboseMoves.length; i++) {
    const m = verboseMoves[i];
    replayChess.move({ from: m.from, to: m.to, promotion: m.promotion });
    plies.push({
      ply: i + 1,
      fen: replayChess.fen(),
      moveSan: m.san,
      moveUci: `${m.from}${m.to}${m.promotion || ""}`,
      mover: m.color === "w" ? "white" : "black"
    });
  }

  const totalPlies = plies.length;
  const engine = new StockfishEngine({ depth, multiPv });
  await engine.init();

  const evaluatedPositions: PositionEvaluation[] = [];

  try {
    for (let i = 0; i < totalPlies; i++) {
      if (signal?.aborted) {
        throw new DOMException("Analysis cancelled by user", "AbortError");
      }

      const p = plies[i];
      const evaluation = await engine.evaluatePosition(p.fen, {
        depth,
        multiPv,
        signal,
        ply: p.ply,
        moveSan: p.moveSan,
        moveUci: p.moveUci
      });

      evaluatedPositions.push(evaluation);

      if (onProgress) {
        onProgress({
          currentPly: i + 1,
          totalPlies,
          percent: Math.round(((i + 1) / totalPlies) * 100),
          evaluation
        });
      }
    }
  } finally {
    await engine.dispose();
  }

  // 2. Classify moves (from mover's perspective)
  const positionRecords: Omit<PositionRecord, "id" | "analysis_id" | "created_at">[] =
    evaluatedPositions.map((pos, idx) => {
      return {
        game_id: game.id,
        user_id: game.user_id ?? "",
        ply: pos.ply,
        fen: pos.fen,
        move_san: pos.moveSan || null,
        move_uci: pos.moveUci || null,
        score_cp: pos.scoreCp,
        mate_in: pos.mateIn,
        win_probability: pos.winProbability,
        best_move_uci: pos.bestMoveUci || null,
        best_move_san: pos.bestMoveSan || null,
        pv_lines: pos.lines
      };
    });

  // 3. Persist to database & local cache
  const saved = await saveAnalysis(
    {
      game_id: game.id,
      user_id: game.user_id,
      depth,
      multipv: multiPv,
      status: "completed",
      moves_analyzed: evaluatedPositions.length,
      total_moves: totalPlies
    },
    positionRecords
  );

  return saved;
}

/**
 * Computes move-by-move accuracy and classifications across all plies.
 */
export function computeMoveClassifications(
  positions: PositionRecord[]
): MoveAnalysisReport[] {
  const reports: MoveAnalysisReport[] = [];

  for (let i = 1; i < positions.length; i++) {
    const before = positions[i - 1];
    const after = positions[i];
    const mover: "white" | "black" = i % 2 === 1 ? "white" : "black";

    const evalBefore = getMoverWinProbability(before.win_probability, mover);
    const evalAfter = getMoverWinProbability(after.win_probability, mover);
    const loss = Math.max(0, Math.round((evalBefore - evalAfter) * 10) / 10);

    const isBestMove =
      before.best_move_uci !== null &&
      after.move_uci !== null &&
      before.best_move_uci === after.move_uci;

    const classification = classifyMove(loss, isBestMove);

    reports.push({
      ply: after.ply,
      mover,
      playedSan: after.move_san || "",
      playedUci: after.move_uci || "",
      bestSan: before.best_move_san || "",
      bestUci: before.best_move_uci || "",
      evalBefore,
      evalAfter,
      loss,
      classification
    });
  }

  return reports;
}

