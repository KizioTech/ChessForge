import { describe, it, expect } from "vitest";
import { fastAnalyzeGame } from "../../src/lib/engine/fast-batch-analyzer";
import type { GameRecord } from "../../src/lib/games";

describe("fast-batch-analyzer", () => {
  it("detects hanging pieces and blunders in a tactical game", async () => {
    // Scholar's mate / Blunder game: White hangs queen or black gets mated
    const pgn = "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0";
    const dummyGame: GameRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "00000000-0000-0000-0000-000000000000",
      user_colour: "black",
      white: "Morphy",
      black: "Consultants",
      result: "1-0",
      pgn,
      fingerprint: "dummy-fp",
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
      total_plies: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = await fastAnalyzeGame(dummyGame);
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.reports.length).toBe(7);

    // Black's move 3... Nf6 allowed Qxf7# checkmate!
    const blackBlunder = result.reports.find(r => r.ply === 6);
    expect(blackBlunder).toBeDefined();
    expect(blackBlunder?.classification).toBe("blunder");
    expect(blackBlunder?.loss).toBeGreaterThan(20);
  });

  it("detects hung piece when queen is placed on attacked square", async () => {
    // 1. e4 d5 2. exd5 Qxd5 3. Qf3?? Qe5+ or hanging queen
    const pgn = "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 *";
    const dummyGame: GameRecord = {
      id: "22222222-2222-2222-2222-222222222222",
      user_id: "00000000-0000-0000-0000-000000000000",
      user_colour: "unknown",
      white: "Player1",
      black: "Player2",
      result: "*",
      pgn,
      fingerprint: "dummy-fp-2",
      moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"],
      total_plies: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = await fastAnalyzeGame(dummyGame);
    expect(result.positions.length).toBe(7);
  });
});

