import { describe, it, expect } from "vitest";
import {
  countMaterialPoints,
  isEndgameFen,
  classifyEndgameCategory,
  mineEndgameMistakes
} from "../../src/lib/endgames/endgame-miner";
import type { MistakeRecord } from "../../src/lib/training/types";
import type { GameRecord } from "../../src/lib/games";

describe("endgame-miner", () => {
  const pawnEndgameFen = "8/5pk1/4p1p1/8/5P1P/6K1/8/8 w - - 0 1";
  const rookEndgameFen = "4k3/R7/4K3/4P3/8/8/8/r7 b - - 0 1";
  const queenEndgameFen = "8/8/8/4k3/8/2Q5/8/4K3 b - - 0 1";
  const middlegameFen = "r1bqk2r/pppp1ppp/2n2n2/4p3/1b2P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 1 5";

  it("countMaterialPoints counts piece values properly", () => {
    const { totalMaterial, queens, rooks, pawns } = countMaterialPoints(pawnEndgameFen);
    expect(queens).toBe(0);
    expect(rooks).toBe(0);
    expect(pawns).toBe(5);
    expect(totalMaterial).toBe(5);
  });

  it("isEndgameFen accurately classifies endgames vs middlegames", () => {
    expect(isEndgameFen(pawnEndgameFen)).toBe(true);
    expect(isEndgameFen(rookEndgameFen)).toBe(true);
    expect(isEndgameFen(middlegameFen)).toBe(false);
  });

  it("classifyEndgameCategory correctly labels categories", () => {
    expect(classifyEndgameCategory(pawnEndgameFen)).toBe("pawn");
    expect(classifyEndgameCategory(rookEndgameFen)).toBe("rook");
    expect(classifyEndgameCategory(queenEndgameFen)).toBe("queen");
  });

  it("mineEndgameMistakes parses mistakes in endgame positions", () => {
    const mockGames: GameRecord[] = [
      {
        id: "game-1",
        pgn: "1. e4 e5 ...",
        result: "1/2-1/2",
        user_colour: "white",
        white: "Player",
        black: "RivalGM",
        moves_count: 55,
        created_at: "2026-03-01"
      }
    ];

    const mockMistakes: MistakeRecord[] = [
      {
        id: "m-1",
        user_id: "user",
        game_id: "game-1",
        ply: 54,
        fen: rookEndgameFen,
        played_san: "Ra6",
        played_uci: "a1a6",
        engine_class: "blunder",
        win_pct_loss: 45,
        best_san: "Ra8+",
        best_uci: "a1a8",
        tags: ["endgame_blunder"],
        user_corrected: false
      },
      // Middlegame blunder (should be filtered out)
      {
        id: "m-2",
        user_id: "user",
        game_id: "game-1",
        ply: 12,
        fen: middlegameFen,
        played_san: "Bd2",
        played_uci: "c1d2",
        engine_class: "blunder",
        win_pct_loss: 20,
        best_san: "Be2",
        best_uci: "f1e2",
        tags: ["opening_error"],
        user_corrected: false
      }
    ];

    const mined = mineEndgameMistakes(mockMistakes, mockGames);
    expect(mined).toHaveLength(1);
    expect(mined[0].gameId).toBe("game-1");
    expect(mined[0].solutionLine).toEqual(["Ra8+"]);
    expect(mined[0].playedSan).toBe("Ra6");
    expect(mined[0].category).toBe("rook");
  });
});
