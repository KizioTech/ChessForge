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

/* -------------------------------------------------------------------------- */
/* Calculation & Blindfold Drills                                             */
/* -------------------------------------------------------------------------- */

export type CalculationCategory =
  | "pawn-race"
  | "rook-cutoff"
  | "triangulation"
  | "tactical-skewer"
  | "breakthrough"
  | "deflection"
  | "mate-net";

export interface CalculationDrill {
  id: string;
  title: string;
  category: CalculationCategory;
  difficulty: EndgameDifficulty;
  initialFen: string;
  sideToMove: "white" | "black";
  /** Sequence of unseen moves the user must visualize without moving pieces on the board */
  unseenMoves: string[];
  /** Pedagogical instruction prompt */
  prompt: string;
  /** Primary expected winning or drawing solution move (SAN) from the resulting mental position */
  solutionMove: string;
  /** Acceptable alternative winning moves (SAN) */
  alternativeSolutions?: string[];
  explanation: string;
  tacticalTheme: string;
}

export interface CalculationAttemptResult {
  correct: boolean;
  playedMove: string;
  expectedMove: string;
  explanation: string;
  targetFen: string;
}

export type BlindfoldPieceMode = "normal" | "ghost" | "blind";

