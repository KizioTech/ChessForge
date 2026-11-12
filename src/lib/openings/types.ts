/**
 * Opening Repertoires — Types & Contracts
 */

export type RepertoireSide = "white" | "black";

export interface RepertoireRecord {
  id: string;
  user_id: string;
  side: RepertoireSide;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface RepertoireLineNode {
  id: string;
  repertoire_id: string;
  user_id: string;
  parent_id: string | null;
  ply: number;
  fen: string;
  san: string;
  uci: string;
  side_to_move: "white" | "black";
  is_user_move: boolean;
  comment?: string;
  created_at: string;
  updated_at: string;
}

/** In-memory tree node for tree rendering and quick lookups */
export interface RepertoireTreeNode {
  node: RepertoireLineNode;
  children: RepertoireTreeNode[];
}

/** Game deviation result */
export interface GameDeviation {
  gameId: string;
  gameWhite: string;
  gameBlack: string;
  gameDate?: string;
  userColour: "white" | "black";
  ply: number;
  moveNumber: number;
  playedSan: string;
  playedUci: string;
  expectedSan: string;
  expectedUci: string;
  fen: string;
}

/** Drill question/step */
export interface DrillStep {
  fen: string;
  ply: number;
  moveNumber: number;
  expectedSan: string;
  expectedUci: string;
  comment?: string;
  historyMoves: string[];
}
