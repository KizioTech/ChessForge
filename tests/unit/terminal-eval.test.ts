import { describe, it, expect } from "vitest";
import { calculateWinProbability } from "../../src/lib/engine/win-probability";

describe("PR A - Terminal Positions & Win Probability (Item 1.6)", () => {
  it("evaluates mate 0 correctly with sideToMove", () => {
    // White is checkmated (sideToMove 'w'): White win probability is 0%
    const whiteMated = calculateWinProbability(null, 0, "w");
    expect(whiteMated).toBe(0.0);

    // Black is checkmated (sideToMove 'b'): White win probability is 100%
    const blackMated = calculateWinProbability(null, 0, "b");
    expect(blackMated).toBe(100.0);
  });

  it("handles mate in positive/negative plies", () => {
    // White has mate in 1
    expect(calculateWinProbability(null, 1)).toBe(100.0);
    // Black has mate in 1
    expect(calculateWinProbability(null, -1)).toBe(0.0);
  });

  it("handles stalemate / equal positions as 50%", () => {
    expect(calculateWinProbability(0, null)).toBe(50.0);
  });
});
