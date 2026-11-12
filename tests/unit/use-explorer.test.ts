import { describe, it, expect } from "vitest";
import { parseExplorerResponse, BoundedCache, explorerErrorMessage, explorerUrl } from "../../src/lib/openings/use-explorer";

describe("parseExplorerResponse", () => {
  it("accepts a valid explorer payload", () => {
    const d = parseExplorerResponse({
      white: 10, draws: 5, black: 7,
      moves: [{ uci: "e2e4", san: "e4", white: 6, draws: 2, black: 3, averageRating: 1500 }]
    });
    expect(d?.moves[0].san).toBe("e4");
    expect(d?.moves[0].averageRating).toBe(1500);
  });
  it("rejects error bodies and malformed data instead of letting them reach the UI", () => {
    expect(parseExplorerResponse({ error: "Too many requests" })).toBeNull();
    expect(parseExplorerResponse(null)).toBeNull();
    expect(parseExplorerResponse("oops")).toBeNull();
    expect(parseExplorerResponse({ white: 1, draws: 1, black: 1 })).toBeNull(); // no moves array
    expect(parseExplorerResponse({ white: "1", draws: 1, black: 1, moves: [] })).toBeNull();
  });
  it("drops individual malformed moves but keeps the good ones", () => {
    const d = parseExplorerResponse({
      white: 1, draws: 1, black: 1,
      moves: [{ san: "e4", uci: "e2e4", white: 1, draws: 0, black: 0 }, { san: "bad" }, null]
    });
    expect(d?.moves.length).toBe(1);
  });
});

describe("BoundedCache", () => {
  it("evicts the oldest entry past its limit", () => {
    const c = new BoundedCache<number>(2);
    c.set("a", 1); c.set("b", 2); c.set("c", 3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("c")).toBe(3);
    expect(c.size).toBe(2);
  });
});

describe("explorer helpers", () => {
  it("explains rate limits and auth failures", () => {
    expect(explorerErrorMessage(429)).toMatch(/slow down/);
    expect(explorerErrorMessage(401)).toMatch(/token/);
    expect(explorerErrorMessage(500)).toContain("500");
  });
  it("encodes the FEN in the URL", () => {
    expect(explorerUrl("8/8/8/8/8/8/8/8 w - - 0 1")).toContain("fen=8%2F8%2F8");
  });
});
