import { describe, it, expect } from "vitest";
import { computeWeaknessAnalysis } from "../../src/lib/insight/trend-service";
import type { MistakeRecord } from "../../src/lib/training/types";

describe("Phase 5: Weakness & Trend Service", () => {
  it("enforces N >= 20 baseline requirement (insufficientData: true when games < 20)", () => {
    const mistakes: MistakeRecord[] = [
      {
        id: "m1",
        user_id: "u1",
        game_id: "g1",
        ply: 12,
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        played_san: "Nf3",
        played_uci: "g1f3",
        engine_class: "blunder",
        win_pct_loss: 35,
        tags: ["hanging_piece"],
        user_corrected: false
      }
    ];

    const report = computeWeaknessAnalysis(mistakes, 15, 600);
    expect(report.insufficientData).toBe(true);
    expect(report.totalGames).toBe(15);
  });

  it("marks insufficientData: false when games >= 20", () => {
    const mistakes: MistakeRecord[] = [
      {
        id: "m1",
        user_id: "u1",
        game_id: "g1",
        ply: 12,
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        played_san: "Nf3",
        played_uci: "g1f3",
        engine_class: "blunder",
        win_pct_loss: 35,
        tags: ["hanging_piece", "time_trouble"],
        user_corrected: false
      },
      {
        id: "m2",
        user_id: "u1",
        game_id: "g2",
        ply: 24,
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        played_san: "Re1",
        played_uci: "e1e2",
        engine_class: "mistake",
        win_pct_loss: 18,
        tags: ["back_rank_weakness"],
        user_corrected: false
      }
    ];

    const report = computeWeaknessAnalysis(mistakes, 24, 960);
    expect(report.insufficientData).toBe(false);
    expect(report.totalGames).toBe(24);
    expect(report.timeTroubleCount).toBe(1);
    expect(report.tagFrequencies.find(t => t.tag === "hanging_piece")?.count).toBe(1);
    expect(report.tagFrequencies.find(t => t.tag === "back_rank_weakness")?.count).toBe(1);
  });
});
