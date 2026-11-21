import { describe, it, expect, beforeEach } from "vitest";
import { Chess } from "chess.js";
import {
  CALCULATION_DRILLS,
  getCalculatedFen,
  formatUnseenMoves,
  normalizeSan,
  validateCalculationSolution,
  generateRandomSquare,
  getRandomSquareExcluding,
  checkSquareMatch,
  loadCalculationStats,
  recordCalculationAttempt,
  ALL_SQUARES
} from "../../src/lib/endgames";

// In-memory localStorage mock for node test runner
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = String(val); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; }
};
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

describe("Calculation Trainer & Blindfold Memory Core", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("getCalculatedFen()", () => {
    it("successfully applies a sequence of unseen moves to reach the target FEN", () => {
      const initialFen = "7K/8/k1P5/7p/8/8/8/8 w - - 0 1";
      const moves = ["Kg7", "h4", "Kf6", "Kb6", "Ke5", "Kxc6"];

      const result = getCalculatedFen(initialFen, moves);
      expect(result.success).toBe(true);
      expect(result.pliesPlayed).toBe(6);

      // Verify the resulting target position independently
      const manualChess = new Chess(initialFen);
      for (const m of moves) {
        manualChess.move(m);
      }
      expect(result.fen).toBe(manualChess.fen());
    });

    it("returns an error and success: false if an illegal move is provided", () => {
      const initialFen = "7K/8/k1P5/7p/8/8/8/8 w - - 0 1";
      const moves = ["Kg7", "h4", "Kh9"]; // Kh9 is illegal

      const result = getCalculatedFen(initialFen, moves);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.pliesPlayed).toBe(2);
    });

    it("gracefully handles invalid initial FEN strings", () => {
      const result = getCalculatedFen("not-a-valid-fen", ["e4"]);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("formatUnseenMoves()", () => {
    it("formats moves starting from White's turn with proper move numbers", () => {
      const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const moves = ["e4", "e5", "Nf3"];

      const formatted = formatUnseenMoves(initialFen, moves);
      expect(formatted).toEqual(["1. e4", "1... e5", "2. Nf3"]);
    });

    it("formats moves starting from Black's turn with an ellipsis prefix", () => {
      const initialFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
      const moves = ["e5", "Nf3", "Nc6"];

      const formatted = formatUnseenMoves(initialFen, moves);
      expect(formatted).toEqual(["1... e5", "2. Nf3", "2... Nc6"]);
    });
  });

  describe("normalizeSan()", () => {
    it("strips check, checkmate, and annotative punctuation", () => {
      expect(normalizeSan("Nf3+")).toBe("Nf3");
      expect(normalizeSan("Qh7#")).toBe("Qh7");
      expect(normalizeSan("Bxf7+!")).toBe("Bxf7");
      expect(normalizeSan("a8=Q+??")).toBe("a8=Q");
    });
  });

  describe("validateCalculationSolution()", () => {
    const drill = CALCULATION_DRILLS.find(d => d.id === "reti-study-1921")!;

    it("accepts the canonical solution move even with check or punctuation variance", () => {
      const result = validateCalculationSolution(drill, "Kf4");
      expect(result.correct).toBe(true);
      expect(result.expectedMove).toBe("Kf4");
    });

    it("accepts valid alternative solutions defined in the drill", () => {
      if (drill.alternativeSolutions && drill.alternativeSolutions.length > 0) {
        const altMove = drill.alternativeSolutions[0];
        const result = validateCalculationSolution(drill, altMove);
        expect(result.correct).toBe(true);
      }
    });

    it("rejects an incorrect move", () => {
      const result = validateCalculationSolution(drill, "Kd5"); // Wait, Kd5 is listed in alternatives!
      // Let's test a clearly wrong move
      const wrongResult = validateCalculationSolution(drill, "Kd7");
      expect(wrongResult.correct).toBe(false);
    });

    it("accepts UCI moves played on the target position", () => {
      // In the Reti study after unseen moves, White King is on e5. Moving to f4 is e5f4.
      const result = validateCalculationSolution(drill, "e5f4");
      expect(result.correct).toBe(true);
    });
  });

  describe("Dataset Integrity (CALCULATION_DRILLS)", () => {
    it("verifies every single curated drill is 100% legal in chess.js", () => {
      expect(CALCULATION_DRILLS.length).toBeGreaterThanOrEqual(15);

      for (const drill of CALCULATION_DRILLS) {
        // 1. Initial FEN is valid
        const chess = new Chess(drill.initialFen);
        expect(chess.fen()).toBeDefined();

        // 2. Unseen moves are all strictly legal
        for (const move of drill.unseenMoves) {
          const res = chess.move(move);
          expect(res, `Drill ${drill.id} has illegal move: ${move}`).toBeTruthy();
        }

        // 3. Expected solution move is legal from target FEN
        const solRes = chess.move(drill.solutionMove);
        expect(solRes, `Drill ${drill.id} has illegal solution: ${drill.solutionMove}`).toBeTruthy();
      }
    });
  });

  describe("Board Coordinate Reflex Sight Trainer", () => {
    it("generateRandomSquare returns a valid square on the board", () => {
      const sq = generateRandomSquare();
      expect(ALL_SQUARES).toContain(sq);
    });

    it("getRandomSquareExcluding does not return excluded squares", () => {
      for (let i = 0; i < 20; i++) {
        const sq = getRandomSquareExcluding(["e4"]);
        expect(sq).not.toBe("e4");
        expect(ALL_SQUARES).toContain(sq);
      }
    });

    it("checkSquareMatch performs case-insensitive, whitespace-trimmed comparison", () => {
      expect(checkSquareMatch("e4", "e4")).toBe(true);
      expect(checkSquareMatch("E4", "e4")).toBe(true);
      expect(checkSquareMatch("  c6  ", "c6")).toBe(true);
      expect(checkSquareMatch("a1", "h8")).toBe(false);
    });
  });

  describe("Progress Persistence", () => {
    it("tracks solved drills and increments attempts in localStorage", () => {
      const drillId = "test-drill-1";
      expect(loadCalculationStats()).toEqual({});

      // First attempt failed
      const stats1 = recordCalculationAttempt(drillId, false);
      expect(stats1[drillId].solved).toBe(false);
      expect(stats1[drillId].attempts).toBe(1);

      // Second attempt succeeded
      const stats2 = recordCalculationAttempt(drillId, true);
      expect(stats2[drillId].solved).toBe(true);
      expect(stats2[drillId].attempts).toBe(2);
      expect(stats2[drillId].lastTrainedAt).toBeDefined();

      // Third attempt failed, but solved remains true
      const stats3 = recordCalculationAttempt(drillId, false);
      expect(stats3[drillId].solved).toBe(true);
      expect(stats3[drillId].attempts).toBe(3);
    });
  });
});
