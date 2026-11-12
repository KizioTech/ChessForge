/**
 * Opening Repertoire Deviation Detector
 *
 * Scans a user's played games against their active White/Black repertoires.
 * Identifies the exact moment (ply and move number) the player deviated from
 * their prepared repertoire moves.
 */

import { Chess } from "chess.js";
import type { GameRecord } from "../games";
import type { RepertoireTreeNode, GameDeviation } from "./types";
import { normalizeFen } from "./repertoire-tree";

/**
 * Scan a single game against a repertoire tree.
 * Returns the deviation details if the player deviated from their repertoire,
 * or null if the player followed the repertoire or the opponent left book first.
 */
export function detectGameDeviation(
  game: GameRecord,
  repertoireRoots: RepertoireTreeNode[]
): GameDeviation | null {
  if (game.user_colour !== "white" && game.user_colour !== "black") {
    return null;
  }
  if (!game.pgn || repertoireRoots.length === 0) {
    return null;
  }

  const userColour = game.user_colour;
  const chess = new Chess(game.start_fen || undefined);

  try {
    chess.loadPgn(game.pgn, { strict: false });
  } catch {
    return null;
  }

  const history = chess.history({ verbose: true });
  let currentCandidates = repertoireRoots;

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const isUserTurn = userColour === "white" ? move.color === "w" : move.color === "b";
    const playedSan = move.san;
    const playedUci = `${move.from}${move.to}${move.promotion || ""}`;

    // Find if the played move is one of the candidate moves in the repertoire
    const match = currentCandidates.find(
      c => c.node.san.toLowerCase() === playedSan.toLowerCase() ||
           c.node.uci.toLowerCase() === playedUci.toLowerCase()
    );

    if (isUserTurn) {
      if (!match) {
        // The user was in book, but played a move that is NOT in their repertoire!
        const expectedNode = currentCandidates[0]; // primary recommendation
        return {
          gameId: game.id,
          gameWhite: game.white,
          gameBlack: game.black,
          gameDate: game.played_at,
          userColour,
          ply: i + 1,
          moveNumber: Math.floor(i / 2) + 1,
          playedSan,
          playedUci,
          expectedSan: expectedNode.node.san,
          expectedUci: expectedNode.node.uci,
          fen: normalizeFen(move.before),
        };
      }
      // Followed repertoire; advance down the tree
      currentCandidates = match.children;
    } else {
      // Opponent's turn
      if (!match) {
        // Opponent left the repertoire first — user did not deviate!
        return null;
      }
      currentCandidates = match.children;
    }

    // If there are no further moves in the repertoire, the tree ended naturally
    if (currentCandidates.length === 0) {
      return null;
    }
  }

  return null;
}

/**
 * Scan a list of games and return all detected deviations.
 */
export function detectAllDeviations(
  games: GameRecord[],
  whiteRoots: RepertoireTreeNode[],
  blackRoots: RepertoireTreeNode[]
): GameDeviation[] {
  const deviations: GameDeviation[] = [];

  for (const g of games) {
    const roots = g.user_colour === "white" ? whiteRoots : blackRoots;
    const dev = detectGameDeviation(g, roots);
    if (dev) {
      deviations.push(dev);
    }
  }

  return deviations;
}
