/**
 * Unit Tests for Phase 7: Opening Repertoires (`src/lib/openings`)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeFen,
  buildRepertoireTree,
  pgnToRepertoireNodes,
  exportTreeToPgn,
  startDrillSession,
  submitDrillMove,
  detectGameDeviation,
  type RepertoireLineNode,
} from "../../src/lib/openings";
import type { GameRecord } from "../../src/lib/games";

describe("Repertoire Tree & FEN Normalization", () => {
  it("normalizes FEN by stripping halfmove clock and fullmove number", () => {
    const rawFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const normalized = normalizeFen(rawFen);
    expect(normalized).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3");
  });

  it("builds a hierarchical tree from flat node records", () => {
    const nodes: RepertoireLineNode[] = [
      {
        id: "1",
        repertoire_id: "rep-1",
        user_id: "user-1",
        parent_id: null,
        ply: 1,
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
        san: "e4",
        uci: "e2e4",
        side_to_move: "white",
        is_user_move: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        repertoire_id: "rep-1",
        user_id: "user-1",
        parent_id: "1",
        ply: 2,
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
        san: "e5",
        uci: "e7e5",
        side_to_move: "black",
        is_user_move: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "3",
        repertoire_id: "rep-1",
        user_id: "user-1",
        parent_id: "1",
        ply: 2,
        fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
        san: "c5",
        uci: "c7c5",
        side_to_move: "black",
        is_user_move: false,
        created_at: "",
        updated_at: "",
      },
    ];

    const roots = buildRepertoireTree(nodes);
    expect(roots).toHaveLength(1);
    expect(roots[0].node.san).toBe("e4");
    expect(roots[0].children).toHaveLength(2); // e5 and c5
  });

  it("converts PGN lines into RepertoireLineNode records", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5";
    const nodes = pgnToRepertoireNodes(pgn, "rep-white", "user-1", "white");

    expect(nodes).toHaveLength(5);
    expect(nodes[0].san).toBe("e4");
    expect(nodes[0].is_user_move).toBe(true);
    expect(nodes[1].san).toBe("e5");
    expect(nodes[1].is_user_move).toBe(false);
    expect(nodes[4].san).toBe("Bb5");
  });

  it("exports repertoire tree to standard PGN with variations", () => {
    const nodes: RepertoireLineNode[] = [
      {
        id: "1",
        repertoire_id: "rep-1",
        user_id: "u1",
        parent_id: null,
        ply: 1,
        fen: "",
        san: "e4",
        uci: "e2e4",
        side_to_move: "white",
        is_user_move: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        repertoire_id: "rep-1",
        user_id: "u1",
        parent_id: "1",
        ply: 2,
        fen: "",
        san: "e5",
        uci: "e7e5",
        side_to_move: "black",
        is_user_move: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "3",
        repertoire_id: "rep-1",
        user_id: "u1",
        parent_id: "1",
        ply: 2,
        fen: "",
        san: "c5",
        uci: "c7c5",
        side_to_move: "black",
        is_user_move: false,
        created_at: "",
        updated_at: "",
      },
    ];

    const roots = buildRepertoireTree(nodes);
    const pgn = exportTreeToPgn(roots, "white", "My Test Repertoire");

    expect(pgn).toContain("1. e4");
    expect(pgn).toContain("e5");
    expect(pgn).toContain("(c5)");
  });
});

describe("Repertoire Practice Drilling", () => {
  const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5";
  const nodes = pgnToRepertoireNodes(pgn, "rep-white", "user-1", "white");
  const roots = buildRepertoireTree(nodes);

  it("initializes a drill session for White correctly", () => {
    const { state } = startDrillSession(roots, "white");
    expect(state.side).toBe("white");
    expect(state.isCompleted).toBe(false);
    expect(state.historyMoves).toHaveLength(0);
  });

  it("evaluates correct move and plays opponent automated response", () => {
    const { state } = startDrillSession(roots, "white");
    const { evaluation, nextState } = submitDrillMove(state, roots, "e4");

    expect(evaluation.status).toBe("correct");
    expect(evaluation.opponentReplySan).toBe("e5");
    expect(nextState.correctSteps).toBe(1);
    expect(nextState.historyMoves).toContain("e4");
    expect(nextState.historyMoves).toContain("e5");
  });

  it("evaluates incorrect move and provides expected move feedback", () => {
    const { state } = startDrillSession(roots, "white");
    const { evaluation, nextState } = submitDrillMove(state, roots, "d4");

    expect(evaluation.status).toBe("incorrect");
    expect(evaluation.expectedSan).toBe("e4");
    expect(nextState.failedSteps).toBe(1);
  });
});

describe("Game Deviation Detection", () => {
  const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5";
  const nodes = pgnToRepertoireNodes(pgn, "rep-white", "user-1", "white");
  const roots = buildRepertoireTree(nodes);

  it("detects deviation when user plays an off-book move", () => {
    const testGame: GameRecord = {
      id: "game-1",
      platform: "chesscom",
      fingerprint: "fp-1",
      pgn: "1. e4 e5 2. d4 exd4 3. Qxd4",
      white: "makawa7",
      black: "opponent",
      user_colour: "white",
      result: "1-0",
      rated: true,
      variant: "standard",
      source: "chesscom",
      moves_count: 5,
      created_at: "",
      updated_at: "",
    };

    const deviation = detectGameDeviation(testGame, roots);

    expect(deviation).not.toBeNull();
    expect(deviation?.moveNumber).toBe(2);
    expect(deviation?.playedSan).toBe("d4");
    expect(deviation?.expectedSan).toBe("Nf3");
  });

  it("returns null if user follows their repertoire book", () => {
    const testGame: GameRecord = {
      id: "game-2",
      platform: "chesscom",
      fingerprint: "fp-2",
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4",
      white: "makawa7",
      black: "opponent",
      user_colour: "white",
      result: "1-0",
      rated: true,
      variant: "standard",
      source: "chesscom",
      moves_count: 7,
      created_at: "",
      updated_at: "",
    };

    const deviation = detectGameDeviation(testGame, roots);
    expect(deviation).toBeNull();
  });

  it("returns null if opponent left the book first", () => {
    const testGame: GameRecord = {
      id: "game-3",
      platform: "chesscom",
      fingerprint: "fp-3",
      pgn: "1. e4 c5 2. Nf3 d6", // opponent plays 1...c5 (not in our 1...e5 tree)
      white: "makawa7",
      black: "opponent",
      user_colour: "white",
      result: "1-0",
      rated: true,
      variant: "standard",
      source: "chesscom",
      moves_count: 4,
      created_at: "",
      updated_at: "",
    };

    const deviation = detectGameDeviation(testGame, roots);
    expect(deviation).toBeNull();
  });
});

describe("ECO Opening Book Integration (@chess-openings/eco.json)", () => {
  it("identifies opening from FEN", async () => {
    const { identifyOpeningByFen } = await import("../../src/lib/openings");
    // Position after 1. e4 e5 2. Nf3
    const op = await identifyOpeningByFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
    expect(op).not.toBeNull();
    expect(op?.eco).toBe("C40");
    expect(op?.name).toContain("King's Knight Opening");
  });

  it("identifies opening from chess.js game instance", async () => {
    const { Chess } = await import("chess.js");
    const { identifyOpeningFromGame } = await import("../../src/lib/openings");
    const chess = new Chess();
    chess.loadPgn("1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6");
    const { opening } = await identifyOpeningFromGame(chess);

    expect(opening).not.toBeNull();
    expect(opening?.eco).toBe("B90");
    expect(opening?.name).toContain("Sicilian");
  });

  it("searches openings catalog by keyword", async () => {
    const { searchEcoOpenings } = await import("../../src/lib/openings");
    const results = await searchEcoOpenings("Caro-Kann", 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain("caro-kann");
  });

  it("browses openings list with category and rootsOnly filters", async () => {
    const { getOpeningsList } = await import("../../src/lib/openings");
    
    // Canonical roots only
    const rootsResult = await getOpeningsList({ rootsOnly: true, limit: 10 });
    expect(rootsResult.total).toBeGreaterThan(400);
    expect(rootsResult.items.length).toBe(10);
    expect(rootsResult.items[0].isEcoRoot).toBe(true);

    // Filter by ECO Category B (Semi-Open)
    const catBResult = await getOpeningsList({ category: "B", rootsOnly: true, limit: 5 });
    expect(catBResult.items.length).toBe(5);
    for (const item of catBResult.items) {
      expect(item.eco.startsWith("B")).toBe(true);
    }

    // Search query within list
    const searchResult = await getOpeningsList({ query: "French", limit: 5 });
    expect(searchResult.items.length).toBeGreaterThan(0);
    expect(searchResult.items[0].name.toLowerCase()).toContain("french");
  });
});
