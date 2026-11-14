import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { DEEP_THEORY_LINES } from "../../src/data/openings/theory-lines";
import { pgnToSan } from "../../src/lib/openings/opening-book";

describe("Curated Deep Theoretical Lines (8+ moves average)", () => {
  it("contains dozens of deep theoretical main lines", () => {
    expect(DEEP_THEORY_LINES.length).toBeGreaterThanOrEqual(40);
  });

  it("ensures every deep theory line has valid, legal moves in chess.js", () => {
    for (const line of DEEP_THEORY_LINES) {
      const chess = new Chess();
      expect(() => chess.loadPgn(line.pgn), `Theory line failed to parse: ${line.name}`).not.toThrow();
      const moves = pgnToSan(line.pgn);
      // Verify lines reach at least 7-13 full moves (14 to 26 plies)
      expect(moves.length, `Theory line too short: ${line.name}`).toBeGreaterThanOrEqual(14);
    }
  });

  it("calculates average depth across all theory lines to be at least 8 moves (16 plies)", () => {
    const totalPlies = DEEP_THEORY_LINES.reduce((sum, l) => sum + pgnToSan(l.pgn).length, 0);
    const avgPlies = totalPlies / DEEP_THEORY_LINES.length;
    // 16 plies = 8 full moves
    expect(avgPlies).toBeGreaterThanOrEqual(16);
  });
});
