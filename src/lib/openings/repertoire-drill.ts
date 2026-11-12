/**
 * Repertoire Drilling / Active Recall Engine
 *
 * Implements interactive practice:
 * - Walks a repertoire tree from a given position.
 * - Handles automated opponent responses (branching picked at random or sequentially).
 * - Tests the user when it is their turn to move.
 * - Evaluates candidate responses and tracks accuracy.
 */

import { Chess } from "chess.js";
import type { RepertoireTreeNode, DrillStep } from "./types";
import { START_FEN, normalizeFen } from "./repertoire-tree";

export interface DrillState {
  currentFen: string;
  historyMoves: string[];
  currentNode: RepertoireTreeNode | null;
  side: "white" | "black";
  totalSteps: number;
  correctSteps: number;
  failedSteps: number;
  isCompleted: boolean;
}

export interface DrillEvaluation {
  status: "correct" | "incorrect" | "out_of_book";
  expectedSan?: string;
  expectedUci?: string;
  comment?: string;
  opponentReplySan?: string;
  nextFen?: string;
  isCompleted: boolean;
}

/**
 * Initialize a drill session from a repertoire tree.
 * If the user plays White, the first step is White's move.
 * If the user plays Black, the system immediately plays White's first move from the tree.
 */
export function startDrillSession(
  roots: RepertoireTreeNode[],
  side: "white" | "black"
): { state: DrillState; initialOpponentMove?: string } {
  const chess = new Chess();
  const state: DrillState = {
    currentFen: START_FEN,
    historyMoves: [],
    currentNode: null,
    side,
    totalSteps: 0,
    correctSteps: 0,
    failedSteps: 0,
    isCompleted: false,
  };

  if (roots.length === 0) {
    state.isCompleted = true;
    return { state };
  }

  // If user plays Black, system plays White's first move
  if (side === "black") {
    // Pick an opponent move randomly among roots
    const chosenRoot = roots[Math.floor(Math.random() * roots.length)];
    chess.move(chosenRoot.node.san);
    state.currentFen = chess.fen();
    state.historyMoves.push(chosenRoot.node.san);
    state.currentNode = chosenRoot;
    return { state, initialOpponentMove: chosenRoot.node.san };
  }

  return { state };
}

/**
 * Play a user move during an active drill session.
 */
export function submitDrillMove(
  state: DrillState,
  roots: RepertoireTreeNode[],
  playedSanOrUci: string
): { evaluation: DrillEvaluation; nextState: DrillState } {
  const nextState: DrillState = { ...state };
  nextState.totalSteps++;

  // Determine available repertoire responses at the current position
  const availableCandidates = state.currentNode === null
    ? roots
    : state.currentNode.children;

  if (availableCandidates.length === 0) {
    nextState.isCompleted = true;
    return {
      evaluation: { status: "out_of_book", isCompleted: true },
      nextState,
    };
  }

  const target = playedSanOrUci.trim().toLowerCase();
  const matchingNode = availableCandidates.find(
    c => c.node.san.toLowerCase() === target || c.node.uci.toLowerCase() === target
  );

  if (!matchingNode) {
    // Incorrect move
    nextState.failedSteps++;
    const primaryCandidate = availableCandidates[0];
    return {
      evaluation: {
        status: "incorrect",
        expectedSan: primaryCandidate.node.san,
        expectedUci: primaryCandidate.node.uci,
        comment: primaryCandidate.node.comment,
        isCompleted: false,
      },
      nextState,
    };
  }

  // Correct move played!
  nextState.correctSteps++;
  const chess = new Chess(state.currentFen);
  chess.move(matchingNode.node.san);
  nextState.historyMoves.push(matchingNode.node.san);
  nextState.currentFen = chess.fen();
  nextState.currentNode = matchingNode;

  // Now, does the opponent have responses in the repertoire?
  const opponentResponses = matchingNode.children;
  if (opponentResponses.length === 0) {
    // End of this branch reached!
    nextState.isCompleted = true;
    return {
      evaluation: {
        status: "correct",
        comment: matchingNode.node.comment,
        isCompleted: true,
      },
      nextState,
    };
  }

  // Pick an opponent response (randomly among available branches)
  const opponentChoice = opponentResponses[Math.floor(Math.random() * opponentResponses.length)];
  chess.move(opponentChoice.node.san);
  nextState.historyMoves.push(opponentChoice.node.san);
  nextState.currentFen = chess.fen();
  nextState.currentNode = opponentChoice;

  // If opponent move terminates the tree:
  const nextUserCandidates = opponentChoice.children;
  const isBranchDone = nextUserCandidates.length === 0;
  if (isBranchDone) {
    nextState.isCompleted = true;
  }

  return {
    evaluation: {
      status: "correct",
      comment: matchingNode.node.comment,
      opponentReplySan: opponentChoice.node.san,
      nextFen: nextState.currentFen,
      isCompleted: isBranchDone,
    },
    nextState,
  };
}
