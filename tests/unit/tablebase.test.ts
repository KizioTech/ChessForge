/**
 * tablebase.test.ts — Unit tests for Phase 8 Syzygy 7-Piece Tablebase integration
 *
 * Verifies:
 * 1. countPieces correctly counts piece quantities from FENs.
 * 2. canProbeTablebase validates 2..7 pieces constraint.
 * 3. formatTablebaseOutcome formats win, draw, loss, cursed-win, and checkmate.
 * 4. probeTablebase parses API responses, caches results, and handles errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  countPieces,
  canProbeTablebase,
  formatTablebaseOutcome,
  probeTablebase,
  clearTablebaseCache,
  type TablebaseResult
} from "../../src/lib/endgames/tablebase";

describe("tablebase piece counting & validation", () => {
  it("counts pieces correctly in full and endgame FENs", () => {
    // Starting position: 32 pieces
    expect(countPieces("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(32);
    // King and Rook vs King: 3 pieces
    expect(countPieces("8/8/8/4k3/8/8/8/4K2R w K - 0 1")).toBe(3);
    // King and Pawn vs King: 3 pieces
    expect(countPieces("4k3/4P3/4K3/8/8/8/8/8 w - - 0 1")).toBe(3);
    // Lucena Position: 5 pieces
    expect(countPieces("1K1k4/1P6/8/8/8/8/2r5/1R6 w - - 0 1")).toBe(5);
    // Empty or malformed
    expect(countPieces("")).toBe(0);
  });

  it("canProbeTablebase validates the 2..7 pieces threshold", () => {
    expect(canProbeTablebase("8/8/8/4k3/8/8/8/4K2R w K - 0 1")).toBe(true); // 3 pieces
    expect(canProbeTablebase("1K1k4/1P6/8/8/8/8/2r5/1R6 w - - 0 1")).toBe(true); // 5 pieces
    expect(canProbeTablebase("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false); // 32 pieces
    expect(canProbeTablebase("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(false); // 0 pieces
  });
});

describe("formatTablebaseOutcome", () => {
  it("formats theoretical win with DTM", () => {
    const res: TablebaseResult = {
      category: "win",
      dtz: 1,
      dtm: 14,
      checkmate: false,
      stalemate: false,
      insufficientMaterial: false,
      moves: []
    };
    const formatted = formatTablebaseOutcome(res);
    expect(formatted.outcome).toBe("win");
    expect(formatted.headline).toBe("Win in 14");
    expect(formatted.detail).toContain("14 moves");
  });

  it("formats theoretical draw", () => {
    const res: TablebaseResult = {
      category: "draw",
      dtz: 0,
      dtm: 0,
      checkmate: false,
      stalemate: false,
      insufficientMaterial: false,
      moves: []
    };
    const formatted = formatTablebaseOutcome(res);
    expect(formatted.outcome).toBe("draw");
    expect(formatted.headline).toBe("Tablebase Draw");
  });

  it("formats cursed win as draw due to 50-move rule", () => {
    const res: TablebaseResult = {
      category: "cursed-win",
      dtz: 55,
      dtm: 80,
      checkmate: false,
      stalemate: false,
      insufficientMaterial: false,
      moves: []
    };
    const formatted = formatTablebaseOutcome(res);
    expect(formatted.outcome).toBe("draw");
    expect(formatted.headline).toContain("Cursed Win");
    expect(formatted.detail).toContain("50-move rule");
  });

  it("formats checkmate and stalemate", () => {
    const mate: TablebaseResult = {
      category: "win",
      dtz: 0,
      dtm: 0,
      checkmate: true,
      stalemate: false,
      insufficientMaterial: false,
      moves: []
    };
    expect(formatTablebaseOutcome(mate).headline).toBe("Checkmate");

    const stale: TablebaseResult = {
      category: "draw",
      dtz: 0,
      dtm: 0,
      checkmate: false,
      stalemate: true,
      insufficientMaterial: false,
      moves: []
    };
    expect(formatTablebaseOutcome(stale).headline).toBe("Stalemate");
  });
});

describe("probeTablebase API and caching", () => {
  beforeEach(() => {
    clearTablebaseCache();
    vi.restoreAllMocks();
  });

  it("returns null immediately for positions with > 7 pieces without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await probeTablebase("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches, parses, and caches tablebase responses", async () => {
    const mockApiResponse = {
      category: "win",
      dtz: 1,
      precise_dtz: 1,
      dtm: 12,
      checkmate: false,
      stalemate: false,
      insufficient_material: false,
      moves: [
        {
          uci: "b1b7",
          san: "Rb7+",
          category: "win",
          dtz: 0,
          precise_dtz: 0,
          dtm: -11,
          zeroing: true,
          checkmate: false,
          stalemate: false
        }
      ]
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    } as any);

    const fen = "1K1k4/1P6/8/8/8/8/2r5/1R6 w - - 0 1";
    const res = await probeTablebase(fen);

    expect(res).not.toBeNull();
    expect(res!.category).toBe("win");
    expect(res!.dtm).toBe(12);
    expect(res!.moves).toHaveLength(1);
    expect(res!.moves[0].san).toBe("Rb7+");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should hit in-memory cache without calling fetch
    const cachedRes = await probeTablebase(fen);
    expect(cachedRes).toEqual(res);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // not called again
  });

  it("handles network failure gracefully without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network Error"));

    const fen = "4k3/4P3/4K3/8/8/8/8/8 w - - 0 1";
    const result = await probeTablebase(fen);
    expect(result).toBeNull();
  });
});
