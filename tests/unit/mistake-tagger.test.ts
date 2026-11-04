import { describe, it, expect } from "vitest";
import { tagMistake, parseClockSeconds, type MistakeTaggingInput } from "../../src/lib/insight/mistake-tagger";

describe("Phase 5: Mistake Tagger Heuristics", () => {
  it("parses clock annotations correctly", () => {
    expect(parseClockSeconds("[%clk 0:00:25]")).toBe(25);
    expect(parseClockSeconds("[%clk 0:01:30]")).toBe(90);
    expect(parseClockSeconds("0:00:15")).toBe(15);
    expect(parseClockSeconds("0:45")).toBe(45);
    expect(parseClockSeconds(null)).toBeNull();
  });

  it("tags time trouble when clock is under 30 seconds", () => {
    const input: MistakeTaggingInput = {
      fenBefore: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      fenAfter: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5P2/PPPP2PP/RNBQKB1R b KQkq - 0 3",
      playedUci: "f2f3",
      playedSan: "f3",
      classification: "mistake",
      winPctLoss: 16,
      clockRemainingSeconds: 22
    };

    const result = tagMistake(input);
    expect(result.tags).toContain("time_trouble");
    expect(result.confidence.time_trouble).toBeGreaterThanOrEqual(0.8);
  });

  it("tags hanging piece when player leaves a piece undefended or hangs a minor/major piece", () => {
    // Explicit hanging piece: White plays a knight to e5 where black's d6 pawn can take it for free
    const fenHangKnightBefore = "rnbqkb1r/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    const fenHangKnightAfter = "rnbqkb1r/ppp1pppp/3p4/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 1 3";

    const input: MistakeTaggingInput = {
      fenBefore: fenHangKnightBefore,
      fenAfter: fenHangKnightAfter,
      playedUci: "g1e5",
      playedSan: "Ne5",
      bestUci: "g1f3",
      bestSan: "Nf3",
      classification: "blunder",
      winPctLoss: 35
    };

    const result = tagMistake(input);
    expect(result.tags).toContain("hanging_piece");
    expect(result.confidence.hanging_piece).toBeGreaterThanOrEqual(0.7);
  });

  it("tags missed mate when best line had forced mate but player blundered", () => {
    const fenBefore = "r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"; // Qh7# is mate
    const fenAfter = "r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/P7/1PPP1PPP/RNB1K1NR b KQkq - 0 4";

    const input: MistakeTaggingInput = {
      fenBefore,
      fenAfter,
      playedUci: "a2a3",
      playedSan: "a3",
      bestUci: "h5h7",
      bestSan: "Qxf7#",
      pvLines: [
        {
          rank: 1,
          scoreCp: null,
          mateIn: 1,
          uci: "h5h7",
          san: "Qxf7#",
          pv: ["h5h7"]
        }
      ],
      classification: "blunder",
      winPctLoss: 80
    };

    const result = tagMistake(input);
    expect(result.tags).toContain("missed_mate");
    expect(result.confidence.missed_mate).toBeGreaterThanOrEqual(0.9);
  });

  it("tags missed fork when best move executes a royal fork / double attack", () => {
    // White knight can fork Black king on e8 and rook on a8 via Nc7+
    const forkFenBefore = "r3k3/pppn1ppp/8/3N4/8/8/PPP2PPP/R3K2R w - - 0 13"; // Nc7+ forks e8 and a8
    const forkFenAfter = "r3k3/pppn1ppp/8/3N4/8/5P2/PPP3PP/R3K2R b - - 0 13"; // White played f3??

    const input: MistakeTaggingInput = {
      fenBefore: forkFenBefore,
      fenAfter: forkFenAfter,
      playedUci: "f2f3",
      playedSan: "f3",
      bestUci: "d5c7",
      bestSan: "Nc7+",
      classification: "mistake",
      winPctLoss: 25
    };

    const result = tagMistake(input);
    expect(result.tags).toContain("missed_fork");
  });

  it("tags back rank weakness when move permits back rank checkmate", () => {
    const input: MistakeTaggingInput = {
      fenBefore: "4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
      fenAfter: "4r1k1/5ppp/8/8/8/8/R4PPP/6K1 b - - 0 1", // White moved Re1 to a2?? Now Re1# is threatened
      playedUci: "e1a2",
      playedSan: "Ra2",
      bestUci: "e1e8",
      bestSan: "Rxe8+",
      classification: "blunder",
      winPctLoss: 90
    };

    const result = tagMistake(input);
    expect(result.tags).toContain("back_rank_weakness");
  });

  it("applies missed_tactic as catch-all when high win% loss occurs with no specialized pattern", () => {
    const input: MistakeTaggingInput = {
      fenBefore: "r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
      fenAfter: "r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 1 5",
      playedUci: "e1g1",
      playedSan: "O-O",
      bestUci: "d3e4",
      bestSan: "dxe4",
      classification: "mistake",
      winPctLoss: 22
    };

    const result = tagMistake(input);
    expect(result.tags.length).toBeGreaterThan(0);
  });
});
