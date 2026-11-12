/**
 * Repertoire Tree Data Structures & Utilities
 *
 * Implements:
 * - FEN normalization for accurate position matching
 * - Building tree structures from flat database rows
 * - Adding moves and variations to trees
 * - Importing PGN games/studies into a repertoire tree
 * - Exporting repertoire tree back to PGN
 */

import { Chess } from "chess.js";
import type { RepertoireLineNode, RepertoireTreeNode, RepertoireSide } from "./types";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Normalize a FEN to EPD format (piece placement, turn, castling, en passant)
 * dropping the halfmove clock and fullmove number so transpositions match.
 */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return fen.trim();
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

/**
 * Build a tree structure from flat database rows.
 * Returns an array of root nodes (moves from the starting position).
 */
export function buildRepertoireTree(nodes: RepertoireLineNode[]): RepertoireTreeNode[] {
  const nodeMap = new Map<string, RepertoireTreeNode>();
  const roots: RepertoireTreeNode[] = [];

  for (const n of nodes) {
    nodeMap.set(n.id, { node: n, children: [] });
  }

  for (const n of nodes) {
    const treeNode = nodeMap.get(n.id);
    if (!treeNode) continue;

    if (n.parent_id && nodeMap.has(n.parent_id)) {
      nodeMap.get(n.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

/**
 * Find a node matching a given normalized FEN and played SAN/UCI.
 */
export function findMatchingChild(
  children: RepertoireTreeNode[],
  sanOrUci: string
): RepertoireTreeNode | undefined {
  const target = sanOrUci.trim().toLowerCase();
  return children.find(
    c => c.node.san.toLowerCase() === target || c.node.uci.toLowerCase() === target
  );
}

/**
 * Parse a PGN movetext string and convert into a list of new RepertoireLineNode entries
 * to merge into an existing repertoire.
 */
export function pgnToRepertoireNodes(
  pgnText: string,
  repertoireId: string,
  userId: string,
  side: RepertoireSide
): RepertoireLineNode[] {
  const chess = new Chess();
  chess.loadPgn(pgnText, { strict: false });

  const history = chess.history({ verbose: true });
  const result: RepertoireLineNode[] = [];
  let parentId: string | null = null;

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const isUserMove = side === "white" ? move.color === "w" : move.color === "b";
    const sideToMove = move.color === "w" ? "white" : "black";
    const nodeId = crypto.randomUUID ? crypto.randomUUID() : `node_${Date.now()}_${i}`;

    const lineNode: RepertoireLineNode = {
      id: nodeId,
      repertoire_id: repertoireId,
      user_id: userId,
      parent_id: parentId,
      ply: i + 1,
      fen: normalizeFen(move.after),
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ""}`,
      side_to_move: sideToMove,
      is_user_move: isUserMove,
      comment: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    result.push(lineNode);
    parentId = nodeId;
  }

  return result;
}

/**
 * Export a tree of repertoire nodes to standard PGN notation.
 */
export function exportTreeToPgn(
  roots: RepertoireTreeNode[],
  side: RepertoireSide,
  title: string
): string {
  const headers = [
    `[Event "${title}"]`,
    `[Site "ChessForge"]`,
    `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]`,
    `[White "${side === "white" ? "Repertoire" : "Opponent"}"]`,
    `[Black "${side === "black" ? "Repertoire" : "Opponent"}"]`,
    `[Result "*"]`,
  ].join("\n");

  function walk(node: RepertoireTreeNode): string {
    const moveNum = Math.floor((node.node.ply - 1) / 2) + 1;
    const isWhite = node.node.ply % 2 !== 0;
    const prefix = isWhite ? `${moveNum}. ` : "";
    let str = `${prefix}${node.node.san}`;
    if (node.node.comment) {
      str += ` {${node.node.comment}}`;
    }

    if (node.children.length === 1) {
      return `${str} ${walk(node.children[0])}`;
    }

    if (node.children.length > 1) {
      const main = `${str} ${walk(node.children[0])}`;
      const variations = node.children
        .slice(1)
        .map(c => `(${walk(c)})`)
        .join(" ");
      return `${main} ${variations}`;
    }

    return str;
  }

  const movesText = roots.map(r => walk(r)).join("\n\n");
  return `${headers}\n\n${movesText || "*"}\n`;
}
