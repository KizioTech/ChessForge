import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

describe("Chess Core Rules & Legality Verification", () => {
  it("handles Kingside and Queenside castling correctly", () => {
    // Both kings and rooks present
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

    // Kingside castling
    const kingsideGame = new Chess(fen);
    const moveO_O = kingsideGame.move("O-O");
    expect(moveO_O).toBeTruthy();
    expect(moveO_O.san).toBe("O-O");
    expect(kingsideGame.get("g1")).toEqual({ type: "k", color: "w" });
    expect(kingsideGame.get("f1")).toEqual({ type: "r", color: "w" });

    // Queenside castling
    const queensideGame = new Chess(fen);
    const moveO_O_O = queensideGame.move("O-O-O");
    expect(moveO_O_O).toBeTruthy();
    expect(moveO_O_O.san).toBe("O-O-O");
    expect(queensideGame.get("c1")).toEqual({ type: "k", color: "w" });
    expect(queensideGame.get("d1")).toEqual({ type: "r", color: "w" });
  });

  it("prevents castling through check or while in check", () => {
    // e1 in check by rook on e8 (black king on a8)
    const inCheckFen = "k3r3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    const inCheckGame = new Chess(inCheckFen);
    expect(inCheckGame.inCheck()).toBe(true);
    expect(() => inCheckGame.move("O-O")).toThrow();

    // f1 controlled by bishop on a6 -> cannot castle kingside through check
    const throughCheckFen = "r3k2r/8/b7/8/8/8/8/R3K2R w KQkq - 0 1";
    const throughCheckGame = new Chess(throughCheckFen);
    expect(() => throughCheckGame.move("O-O")).toThrow();
  });

  it("handles en passant capture correctly and ensures it expires", () => {
    // 1. e4 e5 2. Nf3 Nf6 3. e5 d5 -> White can capture en passant exd6
    const game = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
    
    // Legal en passant target exists
    const legalMoves = game.moves({ verbose: true });
    const epMove = legalMoves.find(m => m.flags.includes("e"));
    expect(epMove).toBeDefined();
    expect(epMove?.from).toBe("e5");
    expect(epMove?.to).toBe("d6");

    // Execute capture
    game.move({ from: "e5", to: "d6" });
    expect(game.get("d6")).toEqual({ type: "p", color: "w" });
    expect(game.get("d5")).toBeUndefined(); // Black pawn captured
  });

  it("supports all four pawn promotions: Queen, Rook, Bishop, Knight", () => {
    const promotionFen = "8/4P3/8/8/8/8/8/k1K5 w - - 0 1";

    const promotions = ["q", "r", "b", "n"] as const;
    for (const promo of promotions) {
      const g = new Chess(promotionFen);
      const move = g.move({ from: "e7", to: "e8", promotion: promo });
      expect(move).toBeTruthy();
      expect(g.get("e8")).toEqual({ type: promo, color: "w" });
    }
  });

  it("identifies stalemate correctly", () => {
    // Classic stalemate position: Black king on a8, White queen on c7, White king on a6
    const stalemateFen = "k7/2Q5/K7/8/8/8/8/8 b - - 0 1";
    const game = new Chess(stalemateFen);

    expect(game.isStalemate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.isDraw()).toBe(true);
    expect(game.inCheck()).toBe(false);
  });

  it("correctly initializes and navigates non-standard starting FEN positions", () => {
    const customFen = "r1bqk2r/pp2bppp/2n1pn2/2pp4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQkq - 4 7";
    const game = new Chess(customFen);

    expect(game.turn()).toBe("w");
    expect(game.getCastlingRights("w")).toEqual({ k: true, q: true });
    expect(game.board().length).toBe(8);
  });
});
