import { describe, it, expect, beforeAll } from "vitest";
import { loadOpeningBook, type OpeningBook } from "../../src/lib/openings/opening-book";
import {
  findMissedTheoryLines,
  generateOpeningRecommendations
} from "../../src/lib/openings/opening-recommendations";
import type { StatGame, OpeningStat } from "../../src/lib/openings/opening-stats";

describe("opening-recommendations", () => {
  let book: OpeningBook;

  beforeAll(async () => {
    book = await loadOpeningBook();
  });

  it("detects when the user deviates from standard theory as Black in Italian Game", async () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bc4 h6 (3... h6 is not standard Italian theory; 3... Bc5 or 3... Nf6 is)
    const games: StatGame[] = [
      {
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 a6 4. d4 exd4",
        result: "1-0",
        user_colour: "black"
      },
      {
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 a6 4. O-O Nf6",
        result: "0-1",
        user_colour: "black"
      }
    ];

    const missed = findMissedTheoryLines(games, book, 1);
    expect(missed.length).toBeGreaterThan(0);

    const italianMiss = missed.find(m => m.openingFamily === "Italian Game");
    expect(italianMiss).toBeDefined();
    expect(italianMiss?.moveNumber).toBe(3);
    expect(italianMiss?.userColour).toBe("black");
    expect(italianMiss?.playedSan).toBe("a6");
    expect(italianMiss?.frequency).toBe(2);
    expect(italianMiss?.wins).toBe(1);
    expect(italianMiss?.losses).toBe(1);
    // Common alternatives should include Bc5 or Nf6
    expect(italianMiss?.missedOptions.some(o => o.san === "Bc5" || o.san === "Nf6")).toBe(true);
  });

  it("ignores games where the OPPONENT deviated first", () => {
    // User is Black. White plays 1. e4 e5 2. a3?! (White left book on move 2)
    const games: StatGame[] = [
      {
        pgn: "1. e4 e5 2. a3 Nf6 3. Nc3",
        result: "0-1",
        user_colour: "black"
      }
    ];

    const missed = findMissedTheoryLines(games, book, 1);
    // User did not leave theory first, White did
    expect(missed.length).toBe(0);
  });

  it("generates repair recommendations for struggling openings", () => {
    const stats: OpeningStat[] = [
      {
        family: "French Defense",
        colour: "black",
        games: 4,
        wins: 1,
        draws: 0,
        losses: 3,
        avgLeftBookPly: 5
      }
    ];

    const recs = generateOpeningRecommendations(stats, [], 4);
    const repair = recs.find(r => r.type === "repair");
    expect(repair).toBeDefined();
    expect(repair?.openingFamily).toBe("French Defense");
    expect(repair?.side).toBe("black");
    expect(repair?.score).toBe(25);
  });

  it("generates deepen recommendations for high-performing openings", () => {
    const stats: OpeningStat[] = [
      {
        family: "Italian Game",
        colour: "white",
        games: 5,
        wins: 4,
        draws: 1,
        losses: 0,
        avgLeftBookPly: 12
      }
    ];

    const recs = generateOpeningRecommendations(stats, [], 5);
    const deepen = recs.find(r => r.type === "deepen");
    expect(deepen).toBeDefined();
    expect(deepen?.openingFamily).toBe("Italian Game");
    expect(deepen?.side).toBe("white");
    expect(deepen?.score).toBe(90);
  });

  it("generates fallback starter recommendations when no game history exists", () => {
    const recs = generateOpeningRecommendations([], [], 0);
    expect(recs.length).toBeGreaterThanOrEqual(3);
    expect(recs.some(r => r.openingFamily === "Italian Game")).toBe(true);
    expect(recs.some(r => r.openingFamily === "Caro-Kann Defense")).toBe(true);
  });
});
