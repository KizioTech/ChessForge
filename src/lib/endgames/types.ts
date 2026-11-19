/**
 * types.ts
 *
 * Types for Phase 8: Endgame Lab & Calculation.
 */

export type EndgameCategory = "pawn" | "rook" | "minor" | "queen" | "checkmate";

export type EndgameDifficulty = "beginner" | "intermediate" | "advanced" | "master";

export type EndgameObjective = "win" | "draw";

export interface EndgamePosition {
  id: string;
  title: string;
  category: EndgameCategory;
  difficulty: EndgameDifficulty;
  objective: EndgameObjective;
  sideToMove: "white" | "black";
  fen: string;
  description: string;
  keyConcept: string;
  /** Primary canonical sequence of SAN moves (User move, Opponent reply, User move...) */
  solutionLine: string[];
  /** Optional valid branching lines that also achieve the objective */
  alternativeLines?: string[][];
  explanation: string;
}

export interface EndgamePracticeState {
  positionId: string;
  ply: number;
  history: string[]; // SAN moves played so far
  mistakes: number;
  hintsUsed: number;
  finished: boolean;
  success: boolean;
}

export interface EndgameProgress {
  attempts: number;
  cleared: boolean;
  cleanStreak: number;
  lastTrainedAt?: string;
}

export type EndgameProgressMap = Record<string, EndgameProgress>;
