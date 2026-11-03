import { describe, it, expect } from "vitest";
import {
  parsePgn,
  splitPgnGames,
  computeGameFingerprint,
  categorizeTimeControl,
  detectUserColour,
  parsePgnDate
} from "../../src/lib/pgn-parser";

const samplePgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.11.03"]
[Round "?"]
[White "makawa7"]
[Black "opponent_gm"]
[Result "1-0"]
[WhiteElo "1205"]
[BlackElo "1190"]
[TimeControl "600+0"]
[Termination "makawa7 won by checkmate"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

const multiGamePgn = `[Event "Game 1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Game 2"]
[White "PlayerA"]
[Black "PlayerB"]
[Result "0-1"]

1. d4 d5 2. c4 c6 0-1
`;

const malformedPgn = `[Event "Bad Game"]
[White "Cheater"]
[Black "Victim"]
[Result "*"]

1. e4 e5 2. Ke2 Ke7 3. Ke8# *
`;

describe("Pure TypeScript PGN Parser & Validator", () => {
  it("parses single game PGN correctly with all headers and moves", async () => {
    const report = await parsePgn(samplePgn, "makawa7");

    expect(report.totalParsed).toBe(1);
    expect(report.errors.length).toBe(0);
    expect(report.games.length).toBe(1);

    const game = report.games[0];
    expect(game.white).toBe("makawa7");
    expect(game.black).toBe("opponent_gm");
    expect(game.whiteElo).toBe(1205);
    expect(game.blackElo).toBe(1190);
    expect(game.result).toBe("1-0");
    expect(game.timeControl).toBe("600+0");
    expect(game.timeClass).toBe("Rapid");
    expect(game.userColour).toBe("white");
    expect(game.moves).toEqual(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]);
    expect(game.plies).toBe(7);
    expect(game.fingerprint).toHaveLength(64); // SHA-256 hex
  });

  it("splits and parses multi-game PGN files", async () => {
    const games = splitPgnGames(multiGamePgn);
    expect(games.length).toBe(2);

    const report = await parsePgn(multiGamePgn);
    expect(report.totalParsed).toBe(2);
    expect(report.errors.length).toBe(0);
    expect(report.games.length).toBe(2);

    expect(report.games[0].headers.Event).toBe("Game 1");
    expect(report.games[0].white).toBe("Player1");
    expect(report.games[1].headers.Event).toBe("Game 2");
    expect(report.games[1].white).toBe("PlayerA");
  });

  it("captures descriptive errors on malformed games while allowing valid games to parse", async () => {
    const mixedPgn = `${samplePgn}\n\n${malformedPgn}`;
    const report = await parsePgn(mixedPgn);

    expect(report.totalParsed).toBe(2);
    expect(report.games.length).toBe(1);
    expect(report.errors.length).toBe(1);

    const error = report.errors[0];
    expect(error.gameIndex).toBe(2);
    expect(error.error).toBeDefined();
    expect(error.rawSnippet).toContain("Bad Game");
  });

  it("computes deterministic SHA-256 fingerprints for deduplication", async () => {
    const fp1 = await computeGameFingerprint("e4 e5 Nf3 Nc6", "Alice", "Bob", "2026.11.03");
    const fp2 = await computeGameFingerprint("e4 e5 Nf3 Nc6", "alice", "bob  ", "2026.11.03");
    const fpDiff = await computeGameFingerprint("e4 e5 Nf3 d6", "Alice", "Bob", "2026.11.03");

    expect(fp1).toBe(fp2); // Case and whitespace trimmed match
    expect(fp1).not.toBe(fpDiff); // Different movetext yields different fingerprint
  });

  it("categorizes standard chess time controls correctly", () => {
    expect(categorizeTimeControl("15+0")).toBe("UltraBullet");
    expect(categorizeTimeControl("60+0")).toBe("Bullet");
    expect(categorizeTimeControl("120+1")).toBe("Bullet"); // 120 + 40 = 160 < 180
    expect(categorizeTimeControl("180+2")).toBe("Blitz");  // 180 + 80 = 260
    expect(categorizeTimeControl("300+0")).toBe("Blitz");
    expect(categorizeTimeControl("600+0")).toBe("Rapid");
    expect(categorizeTimeControl("900+10")).toBe("Rapid"); // 900 + 400 = 1300
    expect(categorizeTimeControl("1800+0")).toBe("Classical");
    expect(categorizeTimeControl("1/86400")).toBe("Daily");
    expect(categorizeTimeControl(undefined, "blitz")).toBe("Blitz");
  });

  it("detects user color correctly from username or email", () => {
    expect(detectUserColour("makawa7", "MagnusC", "makawa7")).toBe("white");
    expect(detectUserColour("HikaruN", "makawa7", "makawa7")).toBe("black");
    expect(detectUserColour("Player1", "Player2", "makawa7")).toBe("unknown");
    expect(detectUserColour("makawa7@example.com", "Opponent", "makawa7@example.com")).toBe("white");
  });

  it("parses PGN dates into ISO timestamps", () => {
    expect(parsePgnDate("2026.11.03", "14:30:00")).toBe("2026-11-03T14:30:00.000Z");
    expect(parsePgnDate("2026.11.03")).toBe("2026-11-03T00:00:00.000Z");
    expect(parsePgnDate("????.??.??")).toBeUndefined();
  });
});

