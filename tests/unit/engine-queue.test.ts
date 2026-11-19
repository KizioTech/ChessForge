/**
 * engine-queue.test.ts — Unit tests for UCI parser bounds filtering and engine serialization queue.
 *
 * Tests:
 * 1. parseUciInfoLine ignores lowerbound / upperbound lines (aspiration window artifacts).
 * 2. parseUciInfoLine normalizes scores to White-relative correctly.
 * 3. parseUciInfoLine extracts multiPV rank and PV moves.
 */

import { describe, it, expect } from "vitest";
import { parseUciInfoLine } from "../../src/lib/engine/uci-parser";

describe("parseUciInfoLine – score filtering", () => {
  it("returns null for lowerbound lines", () => {
    const line =
      "info depth 16 seldepth 20 multipv 1 score cp 350 lowerbound pv e2e4";
    expect(parseUciInfoLine(line, "w")).toBeNull();
  });

  it("returns null for upperbound lines", () => {
    const line =
      "info depth 16 seldepth 18 multipv 1 score cp -100 upperbound pv d7d5";
    expect(parseUciInfoLine(line, "b")).toBeNull();
  });

  it("parses a normal White-to-move cp score as-is (White-relative)", () => {
    const line =
      "info depth 16 seldepth 22 multipv 1 score cp 45 pv e2e4 e7e5 g1f3";
    const result = parseUciInfoLine(line, "w");
    expect(result).not.toBeNull();
    expect(result!.scoreCp).toBe(45); // White +45cp
    expect(result!.mateIn).toBeNull();
  });

  it("negates Black-to-move cp score for White-relative normalization", () => {
    // Engine reports cp +30 from Black's perspective → White is at -30
    const line =
      "info depth 16 seldepth 22 multipv 1 score cp 30 pv e7e5 e2e4";
    const result = parseUciInfoLine(line, "b");
    expect(result).not.toBeNull();
    expect(result!.scoreCp).toBe(-30);
  });

  it("normalizes mate score for White to move", () => {
    const line = "info depth 16 seldepth 2 multipv 1 score mate 2 pv d1h5 f7f6 h5f7";
    const result = parseUciInfoLine(line, "w");
    expect(result).not.toBeNull();
    expect(result!.mateIn).toBe(2);
    expect(result!.scoreCp).toBeNull();
  });

  it("negates mate score for Black to move", () => {
    // Engine says mate 1 from Black's POV → White is getting mated in 1 → mateIn = -1
    const line = "info depth 1 seldepth 1 multipv 1 score mate 1 pv e8d7";
    const result = parseUciInfoLine(line, "b");
    expect(result).not.toBeNull();
    expect(result!.mateIn).toBe(-1);
  });

  it("extracts multipv rank correctly", () => {
    const line =
      "info depth 16 seldepth 20 multipv 2 score cp -15 pv d7d5 e2e4";
    const result = parseUciInfoLine(line, "w");
    expect(result).not.toBeNull();
    expect(result!.multiPv).toBe(2);
  });

  it("defaults multipv to 1 when absent", () => {
    const line = "info depth 10 score cp 10 pv e2e4";
    const result = parseUciInfoLine(line, "w");
    expect(result).not.toBeNull();
    expect(result!.multiPv).toBe(1);
  });

  it("extracts pv tokens correctly", () => {
    const line =
      "info depth 16 seldepth 20 multipv 1 score cp 45 pv e2e4 e7e5 g1f3 b8c6";
    const result = parseUciInfoLine(line, "w");
    expect(result).not.toBeNull();
    expect(result!.pv).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
  });

  it("returns null for lines without 'score' token", () => {
    const line = "info depth 16 seldepth 20 multipv 1 nodes 123456";
    expect(parseUciInfoLine(line, "w")).toBeNull();
  });
});
