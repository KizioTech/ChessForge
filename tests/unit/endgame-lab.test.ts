import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  ENDGAME_CURRICULUM,
  startEndgamePractice,
  attemptEndgameMove,
  advanceOpponentMove,
  recordEndgameRun,
  chessAtEndgamePly,
  isCleanRun
} from "../../src/lib/endgames";

describe("Endgame Lab Curriculum & Engine", () => {
  it("ensures every curriculum position has a valid FEN and legal solution moves", () => {
    expect(ENDGAME_CURRICULUM.length).toBeGreaterThan(10);

    for (const pos of ENDGAME_CURRICULUM) {
      const chess = new Chess(pos.fen);
      expect(chess.fen()).toBeTruthy();

      // Step through the solutionLine to verify all moves are 100% legal
      for (const san of pos.solutionLine) {
        expect(() => {
          const move = chess.move(san);
          expect(move).not.toBeNull();
        }).not.toThrow();
      }
    }
  });

  it("handles Lucena bridge building drill correctly", () => {
    const lucena = ENDGAME_CURRICULUM.find(p => p.id === "rook-lucena-position")!;
    expect(lucena).toBeDefined();

    let state = startEndgamePractice(lucena);
    expect(state.ply).toBe(0);

    // User plays 1. Rc4!
    const r1 = attemptEndgameMove(lucena, state, "Rc4");
    expect(r1.correct).toBe(true);
    state = r1.state;
    expect(state.ply).toBe(1);

    // Opponent replies 1... Rd1
    state = advanceOpponentMove(lucena, state);
    expect(state.ply).toBe(2);
    expect(state.history).toContain("Rd1");

    // Board state after 2 moves
    const board = chessAtEndgamePly(lucena, state.history);
    expect(board.history()).toEqual(["Rc4", "Rd1"]);
  });

  it("penalizes mistakes and rejects blunders", () => {
    const opp = ENDGAME_CURRICULUM.find(p => p.id === "pawn-direct-opposition")!;
    let state = startEndgamePractice(opp);

    // Playing an incorrect move like Ke1 or Kd2 instead of Ke3
    const bad = attemptEndgameMove(opp, state, "Kd2");
    expect(bad.correct).toBe(false);
    expect(bad.state.mistakes).toBe(1);
    expect(isCleanRun(bad.state)).toBe(false);
  });

  it("tracks streaks and awards mastery after 2 clean runs", () => {
    let progress = {};
    progress = recordEndgameRun(progress, "rook-lucena-position", true);
    expect(progress["rook-lucena-position"].cleanStreak).toBe(1);
    expect(progress["rook-lucena-position"].cleared).toBe(false);

    // Second clean run awards mastery
    progress = recordEndgameRun(progress, "rook-lucena-position", true);
    expect(progress["rook-lucena-position"].cleanStreak).toBe(2);
    expect(progress["rook-lucena-position"].cleared).toBe(true);
  });
});
