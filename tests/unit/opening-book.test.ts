import { describe, it, expect, beforeAll } from "vitest";
import { Chess } from "chess.js";
import {
  loadOpeningBook,
  listOpenings,
  nextBookMoves,
  pgnToSan,
  identifyOpening,
  identifyOpeningFromPgn,
  openingFamily,
  positionKey,
  type OpeningBook
} from "../../src/lib/openings/opening-book";
import { openingStats } from "../../src/lib/openings/opening-stats";

let book: OpeningBook;
beforeAll(async () => {
  book = await loadOpeningBook();
});

const san = (pgn: string) => {
  const c = new Chess();
  c.loadPgn(pgn);
  return c.history();
};

describe("opening book", () => {
  it("loads thousands of openings offline", () => {
    expect(book.size).toBeGreaterThan(3000);
  });

  it("names a well-known line", () => {
    const m = identifyOpening(book, san("1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6"));
    expect(m.opening?.name).toContain("Najdorf");
    expect(m.opening?.eco).toBe("B90");
    expect(m.leftBookAtPly).toBeNull();
  });

  it("reports where the player left theory", () => {
    const m = identifyOpening(book, san("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Qe2 b5 7. Bb3 d6 8. a4 Bg4 9. h3 Bh5"));
    expect(m.opening?.name).toMatch(/Ruy Lopez/);
    expect(m.bookPly).toBeGreaterThan(8);
    expect(m.leftBookAtPly).toBe(m.bookPly + 1);
  });

  it("resolves transpositions to the same opening", () => {
    const a = identifyOpening(book, san("1. d4 Nf6 2. c4 e6 3. Nc3 Bb4"));
    const b = identifyOpening(book, san("1. c4 e6 2. d4 Nf6 3. Nc3 Bb4"));
    expect(a.opening?.name).toBeTruthy();
    expect(a.opening?.name).toBe(b.opening?.name);
  });

  it("returns no opening for nonsense or very unusual starts", () => {
    const m = identifyOpening(book, san("1. a3 h6 2. h3 a6"));
    expect(m.bookPly).toBeLessThanOrEqual(2);
  });

  it("ignores en passant squares that cannot be captured", () => {
    const x = new Chess();
    x.move("e4");
    expect(positionKey(x).endsWith(" -")).toBe(true);
  });

  it("skips games from custom start positions", () => {
    const pgn = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *';
    expect(identifyOpeningFromPgn(book, pgn).opening).toBeNull();
  });

  it("groups by opening family", () => {
    expect(openingFamily("Sicilian Defense: Najdorf Variation")).toBe("Sicilian Defense");
    expect(openingFamily("Italian Game")).toBe("Italian Game");
  });
});

describe("catalogue helpers", () => {
  it("searches by name and by ECO code, with a total for paging", () => {
    expect(listOpenings(book, { query: "caro-kann", limit: 5 }).items.length).toBe(5);
    expect(listOpenings(book, { query: "caro-kann" }).total).toBeGreaterThan(10);
    const eco = listOpenings(book, { query: "B12", limit: 100 });
    expect(eco.items.length).toBeGreaterThan(0);
    expect(eco.items.every(o => o.eco === "B12")).toBe(true);
  });

  it("filters by category and paginates", () => {
    const c = listOpenings(book, { category: "C", limit: 10, offset: 10 });
    expect(c.items.length).toBe(10);
    expect(c.items.every(o => o.eco.startsWith("C"))).toBe(true);
  });

  it("lists theory continuations", () => {
    const next = nextBookMoves(book, ["e4", "e5"]);
    expect(next.map(n => n.san)).toContain("Nf3");
    expect(nextBookMoves(book, san("1. e4 e5 2. Nf3 Nc6 3. Bb5")).map(n => n.san)).toContain("a6");
  });

  it("converts PGN movetext to SAN", () => {
    expect(pgnToSan("1. e4 e5 2. Nf3")).toEqual(["e4", "e5", "Nf3"]);
  });
});

describe("openingStats", () => {
  const pgn = (moves: string) => `[Event "x"]\n\n${moves} *`;
  const games = [
    { pgn: pgn("1. e4 c5 2. Nf3 d6"), result: "1-0", user_colour: "white" },
    { pgn: pgn("1. e4 c5 2. Nf3 d6"), result: "0-1", user_colour: "white" },
    { pgn: pgn("1. e4 c5 2. Nf3 d6"), result: "1/2-1/2", user_colour: "white" },
    { pgn: pgn("1. d4 d5 2. c4 e6"), result: "0-1", user_colour: "black" },
    { pgn: pgn("1. d4 d5"), result: "*", user_colour: "black" },
    { pgn: pgn("1. e4 e5"), result: "1-0", user_colour: "unknown" }
  ];

  it("counts results from the user's side and skips unfinished or unknown-colour games", () => {
    const rows = openingStats(games, book);
    const sic = rows.find(r => r.family.startsWith("Sicilian") && r.colour === "white")!;
    expect(sic.games).toBe(3);
    expect([sic.wins, sic.draws, sic.losses]).toEqual([1, 1, 1]);
    expect(rows.reduce((n, r) => n + r.games, 0)).toBe(4);
  });

  it("applies a minimum sample size", () => {
    expect(openingStats(games, book, 3).every(r => r.games >= 3)).toBe(true);
  });
});
