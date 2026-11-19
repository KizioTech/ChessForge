import { describe, it, expect } from "vitest";
import { blundersPer100Moves } from "../../src/lib/insight/metrics";
import type { MoveAnalysisReport } from "../../src/lib/engine/types";

describe("PR A - blundersPer100Moves metric (Item 1.3)", () => {
  it("returns null when below minimum move threshold (< 100 moves)", () => {
    const reports: Pick<MoveAnalysisReport, "mover" | "classification">[] = [
      { mover: "white", classification: "blunder" },
      { mover: "white", classification: "good" }
    ];
    const rate = blundersPer100Moves(reports, "white", 100);
    expect(rate).toBeNull();
  });

  it("calculates accurate rate on 200 moves with 4 blunders", () => {
    const reports: Pick<MoveAnalysisReport, "mover" | "classification">[] = [];
    // 4 blunders by white
    for (let i = 0; i < 4; i++) {
      reports.push({ mover: "white", classification: "blunder" });
    }
    // 196 good moves by white
    for (let i = 0; i < 196; i++) {
      reports.push({ mover: "white", classification: "good" });
    }
    // 200 moves by black (including 10 blunders by black)
    for (let i = 0; i < 10; i++) {
      reports.push({ mover: "black", classification: "blunder" });
    }
    for (let i = 0; i < 190; i++) {
      reports.push({ mover: "black", classification: "good" });
    }

    // White should have 4 blunders / 200 moves = 2.0 per 100 moves
    const rateWhite = blundersPer100Moves(reports, "white", 100);
    expect(rateWhite).toBe(2.0);

    // Black should have 10 blunders / 200 moves = 5.0 per 100 moves
    const rateBlack = blundersPer100Moves(reports, "black", 100);
    expect(rateBlack).toBe(5.0);
  });
});
