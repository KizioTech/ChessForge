import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { KNOWN_TRAPS } from "../../src/data/openings/traps";
import { pgnToSan } from "../../src/lib/openings/opening-book";

describe("Curated Opening Traps Catalog", () => {
  it("contains dozens of famous, high-impact tactical traps", () => {
    expect(KNOWN_TRAPS.length).toBeGreaterThanOrEqual(30);
  });

  it("ensures every trap has valid, legal moves in chess.js", () => {
    for (const trap of KNOWN_TRAPS) {
      const chess = new Chess();
      expect(() => chess.loadPgn(trap.pgn), `Trap failed to parse: ${trap.name}`).not.toThrow();
      const moves = pgnToSan(trap.pgn);
      expect(moves.length, `Trap too short: ${trap.name}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("verifies traps cover both White and Black sides", () => {
    const whiteTraps = KNOWN_TRAPS.filter(t => t.side === "white");
    const blackTraps = KNOWN_TRAPS.filter(t => t.side === "black");
    expect(whiteTraps.length).toBeGreaterThan(10);
    expect(blackTraps.length).toBeGreaterThan(10);
  });

  it("contains quintessential traps like Noah's Ark, Siberian, Lasker, and Légal", () => {
    const names = KNOWN_TRAPS.map(t => t.name);
    expect(names.some(n => n.includes("Noah's Ark"))).toBe(true);
    expect(names.some(n => n.includes("Siberian Trap"))).toBe(true);
    expect(names.some(n => n.includes("Lasker Trap"))).toBe(true);
    expect(names.some(n => n.includes("Légal Trap"))).toBe(true);
    expect(names.some(n => n.includes("Blackburne Shilling"))).toBe(true);
    expect(names.some(n => n.includes("Elephant Trap"))).toBe(true);
  });
});
