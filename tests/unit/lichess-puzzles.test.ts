import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractFenAtPly,
  loadCachedPuzzles,
  savePuzzleCache,
  uciToSan,
  FALLBACK_PUZZLES
} from "../../src/lib/training/lichess-puzzles";
import { Chess } from "chess.js";

describe("lichess-puzzles", () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }
    });
  });

  it("loadCachedPuzzles returns empty array when nothing cached", () => {
    expect(loadCachedPuzzles()).toEqual([]);
  });

  it("savePuzzleCache and loadCachedPuzzles round-trips correctly", () => {
    const puzzles = [{
      id: "abc123",
      rating: 1500,
      themes: ["fork", "pin"],
      initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      solution: ["e7e5", "d1h5"],
      pgn: ""
    }];
    savePuzzleCache(puzzles);
    const loaded = loadCachedPuzzles();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("abc123");
    expect(loaded[0].themes).toContain("fork");
  });

  it("extractFenAtPly returns valid FEN after replaying PGN moves", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6";
    const fen = extractFenAtPly(pgn, 2);
    expect(fen).toBeTruthy();
    expect(fen).toContain(" w ");
  });

  it("extractFenAtPly with empty PGN returns starting position", () => {
    const fen = extractFenAtPly("", 0);
    expect(fen).toContain("rnbqkbnr/pppppppp");
  });

  it("uciToSan converts uci move to san notation correctly", () => {
    const chess = new Chess();
    const san = uciToSan(chess, "e2e4");
    expect(san).toBe("e4");
  });

  it("has curated fallback puzzles ready when offline", () => {
    expect(FALLBACK_PUZZLES.length).toBeGreaterThanOrEqual(3);
    expect(FALLBACK_PUZZLES[0].solution.length).toBeGreaterThan(0);
  });
});
