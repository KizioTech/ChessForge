import { describe, it, expect } from "vitest";
import {
  calculateWinProbability,
  getMoverWinProbability,
  classifyMove
} from "../../src/lib/engine/win-probability";
import {
  parseUciInfoLine,
  uciToSan,
  buildPositionEvaluation
} from "../../src/lib/engine/uci-parser";

describe("Win Probability Model (ADR 0003)", () => {
  it("computes 50% for equal (0 cp) positions", () => {
    expect(calculateWinProbability(0, null)).toBe(50.0);
  });

  it("computes expected probabilities for standard centipawn evaluations", () => {
    // At +100 cp, win prob is ~59%
    const p100 = calculateWinProbability(100, null);
    expect(p100).toBeGreaterThanOrEqual(58.0);
    expect(p100).toBeLessThanOrEqual(60.0);

    // At -100 cp, win prob is ~41% (symmetric)
    const m100 = calculateWinProbability(-100, null);
    expect(m100).toBeGreaterThanOrEqual(40.0);
    expect(m100).toBeLessThanOrEqual(42.0);
    expect(Math.round(p100 + m100)).toBe(100);

    // At +300 cp (up a minor piece), win prob is ~75%
    const p300 = calculateWinProbability(300, null);
    expect(p300).toBeGreaterThanOrEqual(74.0);
    expect(p300).toBeLessThanOrEqual(76.0);
  });

  it("handles mate evaluations symmetrically", () => {
    expect(calculateWinProbability(null, 3)).toBe(100.0);
    expect(calculateWinProbability(null, -2)).toBe(0.0);
  });

  it("handles null / NaN gracefully as 50%", () => {
    expect(calculateWinProbability(null, null)).toBe(50.0);
    expect(calculateWinProbability(NaN, null)).toBe(50.0);
  });

  it("converts mover win probabilities correctly", () => {
    // White at 65% White win prob
    expect(getMoverWinProbability(65.0, "white")).toBe(65.0);
    // Black at 65% White win prob -> Black has 35% win prob
    expect(getMoverWinProbability(65.0, "black")).toBe(35.0);
  });

  it("classifies moves according to ADR 0003 thresholds", () => {
    expect(classifyMove(0.4, false)).toBe("best");
    expect(classifyMove(15.0, true)).toBe("best"); // best move rank override
    expect(classifyMove(3.2, false)).toBe("good");
    expect(classifyMove(7.5, false)).toBe("inaccuracy");
    expect(classifyMove(14.8, false)).toBe("mistake");
    expect(classifyMove(28.0, false)).toBe("blunder");
  });
});

describe("UCI Output Parser & Normalization (ADR 0004)", () => {
  it("normalizes scores from White's perspective when White is to move", () => {
    const line = "info depth 16 seldepth 22 multipv 1 score cp 45 nodes 182049 nps 1120000 time 162 pv e2e4 e7e5";
    const parsed = parseUciInfoLine(line, "w");
    expect(parsed).not.toBeNull();
    expect(parsed?.depth).toBe(16);
    expect(parsed?.multiPv).toBe(1);
    expect(parsed?.scoreCp).toBe(45);
    expect(parsed?.mateIn).toBeNull();
    expect(parsed?.pv).toEqual(["e2e4", "e7e5"]);
  });

  it("inverts scores to White-relative when Black is to move", () => {
    // Stockfish says +120 from Black's perspective -> White is -120
    const line = "info depth 14 seldepth 18 multipv 1 score cp 120 pv c7c5 g1f3";
    const parsed = parseUciInfoLine(line, "b");
    expect(parsed).not.toBeNull();
    expect(parsed?.scoreCp).toBe(-120);
  });

  it("normalizes mate scores to White-relative when Black is to move", () => {
    // Stockfish says mate 2 for Black -> White has mate -2
    const line = "info depth 12 multipv 1 score mate 2 pv d8h4 g2g3";
    const parsed = parseUciInfoLine(line, "b");
    expect(parsed?.mateIn).toBe(-2);
  });

  it("converts UCI move to standard algebraic notation (SAN)", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciToSan(startFen, "e2e4")).toBe("e4");
    expect(uciToSan(startFen, "g1f3")).toBe("Nf3");

    // Promotion
    const promoFen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    expect(uciToSan(promoFen, "e7e8q")).toBe("e8=Q");
  });

  it("builds a complete PositionEvaluation with MultiPV candidate lines", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const lines = new Map([
      [1, { depth: 16, multiPv: 1, scoreCp: 35, mateIn: null, pv: ["e2e4", "e7e5"] }],
      [2, { depth: 16, multiPv: 2, scoreCp: 25, mateIn: null, pv: ["d2d4", "d7d5"] }]
    ]);

    const evalRes = buildPositionEvaluation(0, startFen, lines, "e2e4");
    expect(evalRes.depth).toBe(16);
    expect(evalRes.scoreCp).toBe(35);
    expect(evalRes.bestMoveUci).toBe("e2e4");
    expect(evalRes.bestMoveSan).toBe("e4");
    expect(evalRes.lines.length).toBe(2);
    expect(evalRes.lines[0].san).toBe("e4");
    expect(evalRes.lines[1].san).toBe("d4");
    expect(evalRes.winProbability).toBeGreaterThan(50.0);
  });
});

describe("Game Analyzer Pipeline & Move Classification", () => {
  const sampleGame: any = {
    id: "test-game-123",
    user_id: "user-456",
    pgn: "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0",
    start_fen: null,
    white: "PlayerWhite",
    black: "PlayerBlack",
    result: "1-0"
  };

  it("analyzes a full game ply-by-ply reporting progress", async () => {
    const { analyzeGame } = await import("../../src/lib/engine/game-analyzer");

    const progressReports: number[] = [];
    const result = await analyzeGame(sampleGame, {
      depth: 12,
      onProgress: p => progressReports.push(p.percent)
    });

    expect(result.analysis).not.toBeNull();
    expect(result.positions.length).toBe(8); // 0 (start) + 7 plies
    expect(progressReports.length).toBe(8);
    expect(progressReports[progressReports.length - 1]).toBe(100);

    // Final move is Qxf7# checkmate
    const finalPos = result.positions[result.positions.length - 1];
    expect(finalPos.move_san).toBe("Qxf7#");
    expect(finalPos.mate_in).toBe(1);
    expect(finalPos.win_probability).toBe(100.0);
  });

  it("aborts game analysis gracefully when signal fires", async () => {
    const { analyzeGame } = await import("../../src/lib/engine/game-analyzer");

    const controller = new AbortController();
    controller.abort(); // already aborted

    await expect(
      analyzeGame(sampleGame, { signal: controller.signal })
    ).rejects.toThrow();
  });

  it("computes move loss and classifies inaccuracies, mistakes and blunders", async () => {
    const { computeMoveClassifications } = await import(
      "../../src/lib/engine/game-analyzer"
    );

    const positions: any[] = [
      { ply: 0, win_probability: 50.0, best_move_uci: "e2e4", best_move_san: "e4" },
      { ply: 1, win_probability: 52.0, move_uci: "e2e4", move_san: "e4" }, // Best move
      { ply: 2, win_probability: 78.0, move_uci: "f7f6", move_san: "f6" } // Blunder for Black (White win prob jumps to 78%, so Black dropped from 48% to 22%, loss = 26)
    ];

    const reports = computeMoveClassifications(positions);
    expect(reports.length).toBe(2);

    // Move 1 (White played e4) -> Best
    expect(reports[0].mover).toBe("white");
    expect(reports[0].classification).toBe("best");

    // Move 2 (Black played f6) -> Blunder (loss >= 20)
    expect(reports[1].mover).toBe("black");
    expect(reports[1].loss).toBeGreaterThanOrEqual(20);
    expect(reports[1].classification).toBe("blunder");
  });
});
