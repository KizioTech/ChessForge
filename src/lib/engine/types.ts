/**
 * Engine and Analysis Pipeline Types
 * Adheres to ADR 0003 (Win Probability Classification) and ADR 0004 (Stockfish Web Worker Interface).
 */

export type AnalysisStatus = "pending" | "running" | "completed" | "aborted" | "failed";

export type MoveClassification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface EngineConfig {
  depth?: number; // default 16
  multiPv?: number; // default 3 (1..3)
  threads?: number; // default 1
  hashMb?: number; // default 32
}

export interface CandidateLine {
  rank: number; // 1 = best, 2 = 2nd best, etc.
  scoreCp: number | null; // White-relative centipawns (+ is White advantage, - is Black advantage)
  mateIn: number | null; // White-relative moves to mate (+ is White mates, - is Black mates)
  uci: string; // e.g. "e2e4"
  san?: string; // e.g. "e4"
  pv: string[]; // sequence of UCI moves in this variation
  pvSan?: string; // formatted sequence of SAN moves, e.g. "e4 e5 Nf3 Nc6"
}

export interface PositionEvaluation {
  ply: number;
  fen: string;
  depth: number;
  scoreCp: number | null; // White-relative centipawns
  mateIn: number | null; // White-relative moves to mate
  winProbability: number; // 0.0 to 100.0 from White's perspective
  bestMoveUci: string;
  bestMoveSan?: string;
  lines: CandidateLine[];
  moveSan?: string;
  moveUci?: string;
}

export interface MoveAnalysisReport {
  ply: number;
  mover: "white" | "black";
  playedSan: string;
  playedUci: string;
  bestSan: string;
  bestUci: string;
  evalBefore: number; // win prob (0-100) before move from mover's perspective
  evalAfter: number; // win prob (0-100) after move from mover's perspective
  loss: number; // percentage loss in win probability (0-100)
  classification: MoveClassification;
  tags?: string[];
}

export interface GameAnalysisRecord {
  id: string;
  game_id: string;
  user_id: string;
  engine_name: string;
  engine_version: string;
  depth: number;
  multipv: number;
  status: AnalysisStatus;
  moves_analyzed: number;
  total_moves: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PositionRecord {
  id?: string;
  analysis_id: string;
  game_id: string;
  user_id: string;
  ply: number;
  fen: string;
  move_san: string | null;
  move_uci: string | null;
  score_cp: number | null;
  mate_in: number | null;
  win_probability: number;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv_lines: CandidateLine[];
}

export interface Engine {
  init(): Promise<void>;
  isReady(): Promise<boolean>;
  evaluatePosition(
    fen: string,
    options?: {
      depth?: number;
      multiPv?: number;
      signal?: AbortSignal;
      ply?: number;
      moveSan?: string;
      moveUci?: string;
    }
  ): Promise<PositionEvaluation>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

