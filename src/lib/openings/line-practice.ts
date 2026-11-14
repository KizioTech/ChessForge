/**
 * line-practice.ts: the rules of "play this line from memory".
 *
 * The board shows the line move by move. You play your side; the opponent's replies are
 * played for you. A wrong move costs a mistake; a hint is counted too. A run is "clean"
 * (it counts towards mastery) only with no mistakes and no hints.
 */
import type { OpeningSide } from "./learn-tree";

export interface PracticeState {
  /** Plies already on the board. */
  ply: number;
  mistakes: number;
  hints: number;
  finished: boolean;
}

/** SAN without check, mate and annotation marks, for comparing moves. */
export function plainSan(san: string): string {
  return san.replace(/[+#!?]/g, "");
}

export function sameSan(a: string, b: string): boolean {
  return plainSan(a) === plainSan(b);
}

/** True if it is the user's turn at this ply (ply 0 = White to move). */
export function isUserTurn(ply: number, userSide: OpeningSide): boolean {
  return (ply % 2 === 0) === (userSide === "white");
}

export function expectedSan(moves: string[], state: PracticeState): string | null {
  return state.ply < moves.length ? moves[state.ply] : null;
}

/** Play the opponent's moves until it is the user's turn or the line ends. */
export function advanceOpponent(moves: string[], state: PracticeState, userSide: OpeningSide): PracticeState {
  let ply = state.ply;
  while (ply < moves.length && !isUserTurn(ply, userSide)) ply += 1;
  return { ...state, ply, finished: ply >= moves.length };
}

export function startPractice(moves: string[], userSide: OpeningSide): PracticeState {
  return advanceOpponent(moves, { ply: 0, mistakes: 0, hints: 0, finished: moves.length === 0 }, userSide);
}

/**
 * Judge the user's move. A correct move adds one ply (the opponent's reply is added separately
 * with advanceOpponent, so the screen can pause between them). A wrong move changes nothing but the mistake count.
 */
export function attempt(
  moves: string[],
  state: PracticeState,
  userSide: OpeningSide,
  playedSan: string
): { state: PracticeState; correct: boolean } {
  if (state.finished || !isUserTurn(state.ply, userSide)) return { state, correct: false };
  const want = expectedSan(moves, state);
  if (want !== null && sameSan(want, playedSan)) {
    const ply = state.ply + 1;
    return { state: { ...state, ply, finished: ply >= moves.length }, correct: true };
  }
  return { state: { ...state, mistakes: state.mistakes + 1 }, correct: false };
}

export function withHint(state: PracticeState): PracticeState {
  return state.finished ? state : { ...state, hints: state.hints + 1 };
}

/** A clean run counts towards mastery. */
export function isClean(state: PracticeState): boolean {
  return state.finished && state.mistakes === 0 && state.hints === 0;
}

/** How many of the user's moves there are in this line (to show "move 3 of 7"). */
export function userMoveCount(moves: string[], userSide: OpeningSide): number {
  let n = 0;
  for (let i = 0; i < moves.length; i++) if (isUserTurn(i, userSide)) n += 1;
  return n;
}
