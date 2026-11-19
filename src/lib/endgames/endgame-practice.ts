/**
 * endgame-practice.ts
 *
 * Logic for interactive technical endgame drills:
 * - Validates user moves against solution sequences
 * - Plays automatic defensive/opposing responses
 * - Handles hints, mistake tracking, and completion evaluations
 */

import { Chess } from "chess.js";
import type { EndgamePosition, EndgamePracticeState } from "./types";

export function startEndgamePractice(position: EndgamePosition): EndgamePracticeState {
  return {
    positionId: position.id,
    ply: 0,
    history: [],
    mistakes: 0,
    hintsUsed: 0,
    finished: false,
    success: false
  };
}

export interface AttemptResult {
  state: EndgamePracticeState;
  correct: boolean;
  message?: string;
  opponentMove?: string;
}

/** Check if current ply is the user's turn (ply 0, 2, 4...) */
export function isUserTurn(ply: number): boolean {
  return ply % 2 === 0;
}

/** Get the expected SAN move for the current ply */
export function expectedSan(position: EndgamePosition, ply: number): string | null {
  if (ply < position.solutionLine.length) {
    return position.solutionLine[ply];
  }
  return null;
}

/** Attempt a move made by the user */
export function attemptEndgameMove(
  position: EndgamePosition,
  state: EndgamePracticeState,
  san: string
): AttemptResult {
  if (state.finished) {
    return { state, correct: false, message: "Drill is already finished." };
  }

  const expected = expectedSan(position, state.ply);
  if (!expected) {
    return { state, correct: false, message: "No move expected." };
  }

  // Also check if any alternative lines match
  const matchesAlternative = position.alternativeLines?.some(
    line => state.ply < line.length && line[state.ply] === san
  );

  const isMatch = san === expected || matchesAlternative;

  if (!isMatch) {
    return {
      state: {
        ...state,
        mistakes: state.mistakes + 1
      },
      correct: false,
      message: "That is not the optimal theoretical move in this endgame. Try again or request a hint."
    };
  }

  // User played the correct move
  const nextPly = state.ply + 1;
  const nextHistory = [...state.history, san];

  // Did the drill end right here?
  if (nextPly >= position.solutionLine.length) {
    return {
      state: {
        ...state,
        ply: nextPly,
        history: nextHistory,
        finished: true,
        success: true
      },
      correct: true,
      message: "Excellent! You demonstrated the theoretical technique perfectly."
    };
  }

  return {
    state: {
      ...state,
      ply: nextPly,
      history: nextHistory
    },
    correct: true
  };
}

/** Advance the opponent's reply */
export function advanceOpponentMove(
  position: EndgamePosition,
  state: EndgamePracticeState
): EndgamePracticeState {
  if (state.finished || isUserTurn(state.ply)) {
    return state;
  }

  const reply = expectedSan(position, state.ply);
  if (!reply) {
    return { ...state, finished: true, success: true };
  }

  const nextPly = state.ply + 1;
  const nextHistory = [...state.history, reply];
  const isFinished = nextPly >= position.solutionLine.length;

  return {
    ...state,
    ply: nextPly,
    history: nextHistory,
    finished: isFinished,
    success: isFinished
  };
}

/** Build Chess instance up to current ply */
export function chessAtEndgamePly(position: EndgamePosition, history: string[]): Chess {
  const chess = new Chess(position.fen);
  for (const san of history) {
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return chess;
}

export function isCleanRun(state: EndgamePracticeState): boolean {
  return state.mistakes === 0 && state.hintsUsed === 0;
}
