import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  cloneGame,
  createGamePgn,
  formatClock,
  getFlagFallOutcome,
  getGameOutcome,
  playLegalMove
} from "../../src/lib/chess/game-session";

 describe("local game session", () => {
  it("keeps move history while applying only legal moves", () => {
    const game = new Chess();
    const afterFirst = playLegalMove(game, "e2", "e4");
    const afterSecond = playLegalMove(afterFirst, "e7", "e5");

    expect(game.history()).toEqual([]);
    expect(afterSecond.history()).toEqual(["e4", "e5"]);
    expect(() => playLegalMove(afterSecond, "e2", "e5")).toThrow();
  });

  it("recognizes terminal positions and a flag fall with no mating material", () => {
    const mate = new Chess();
    mate.loadPgn("1. f3 e5 2. g4 Qh4#");
    expect(getGameOutcome(mate)).toEqual({ result: "0-1", termination: "checkmate" });

    const bareKings = new Chess("8/8/8/8/8/8/4k3/4K3 w - - 0 1");
    expect(getFlagFallOutcome(bareKings, "white").result).toBe("1/2-1/2");
  });

  it("exports a valid PGN and formats clock values without negative time", () => {
    const game = new Chess();
    game.move("e4");
    const pgn = createGamePgn(game, {
      white: 'A "quoted" player',
      black: "Guest",
      result: "1-0",
      termination: "resignation",
      timeControl: "300+3",
      date: new Date(2026, 10, 23)
    });
    const replay = new Chess();
    replay.loadPgn(pgn);

    expect(replay.history()).toEqual(["e4"]);
    expect(replay.getHeaders()).toMatchObject({ White: "A quoted player", Result: "1-0", TimeControl: "300+3" });
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(61_000)).toBe("01:01");
  });

  it("clones a game without changing its original move history", () => {
    const game = new Chess();
    game.move("d4");
    expect(cloneGame(game).history()).toEqual(["d4"]);
    expect(game.history()).toEqual(["d4"]);
  });
});
