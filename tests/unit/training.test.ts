import { describe, it, expect, beforeEach } from "vitest";
import { calculateNextReview, inferGrade, SM2_DEFAULTS } from "../../src/lib/training/sm2";
import { generateExercisesFromGame } from "../../src/lib/training/exercise-generator";
import { exportGamesToPgn, exportAllDataAsJson } from "../../src/lib/export";
import type { GameRecord } from "../../src/lib/games";
import type { PositionRecord, MoveAnalysisReport } from "../../src/lib/engine/types";

describe("SM-2 Spaced Repetition Scheduler (Section 3.8)", () => {
  it("initializes with default ease 2.5 and calculates Good progression", () => {
    const t0 = new Date("2026-11-03T12:00:00Z");

    // Repetition 1 on Good -> 1 day
    const r1 = calculateNextReview({}, "Good", t0);
    expect(r1.repetitions).toBe(1);
    expect(r1.intervalDays).toBe(1);
    expect(r1.easeFactor).toBe(2.5);
    expect(r1.consecutiveSuccesses).toBe(1);
    expect(r1.isMastered).toBe(false);
    expect(r1.dueAt.toISOString()).toBe("2026-11-04T12:00:00.000Z");

    // Repetition 2 on Good -> 3 days
    const r2 = calculateNextReview(r1, "Good", t0);
    expect(r2.repetitions).toBe(2);
    expect(r2.intervalDays).toBe(3);
    expect(r2.consecutiveSuccesses).toBe(2);
    expect(r2.isMastered).toBe(false);

    // Repetition 3 on Good -> round(3 * 2.5) = 8 days
    const r3 = calculateNextReview(r2, "Good", t0);
    expect(r3.repetitions).toBe(3);
    expect(r3.intervalDays).toBe(8);
    expect(r3.consecutiveSuccesses).toBe(3);
  });

  it("handles Again grade: resets reps and sets 10-minute interval", () => {
    const t0 = new Date("2026-11-03T12:00:00Z");
    const state = { repetitions: 3, easeFactor: 2.5, intervalDays: 8, lapses: 0, consecutiveSuccesses: 3 };

    const result = calculateNextReview(state, "Again", t0);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.consecutiveSuccesses).toBe(0);
    expect(result.easeFactor).toBe(2.3); // 2.5 - 0.20
    expect(result.dueAt.getTime() - t0.getTime()).toBe(10 * 60 * 1000); // exactly 10 min
  });

  it("handles Hard grade: multiplies interval by 1.2 and reduces ease", () => {
    const state = { repetitions: 2, easeFactor: 2.5, intervalDays: 10, lapses: 0 };
    const result = calculateNextReview(state, "Hard");

    expect(result.intervalDays).toBe(12); // 10 * 1.2
    expect(result.easeFactor).toBe(2.35); // 2.5 - 0.15
    expect(result.consecutiveSuccesses).toBe(0);
  });

  it("handles Easy grade: increases ease factor and multiplies interval by 1.3", () => {
    const state = { repetitions: 2, easeFactor: 2.5, intervalDays: 3, lapses: 0, consecutiveSuccesses: 2 };
    const result = calculateNextReview(state, "Easy");

    expect(result.repetitions).toBe(3);
    expect(result.easeFactor).toBe(2.65); // 2.5 + 0.15
    expect(result.intervalDays).toBe(10); // round(3 * 2.5) = 8, then 8 * 1.3 = 10.4 -> 10
    expect(result.consecutiveSuccesses).toBe(3);
  });

  it("enforces interval cap at 60 days", () => {
    const state = { repetitions: 10, easeFactor: 2.5, intervalDays: 50, lapses: 0 };
    const result = calculateNextReview(state, "Good");
    expect(result.intervalDays).toBe(60); // capped at 60
  });

  it("enforces minimum ease factor at 1.3", () => {
    const state = { repetitions: 0, easeFactor: 1.35, intervalDays: 1, lapses: 5 };
    const result = calculateNextReview(state, "Again");
    expect(result.easeFactor).toBe(1.3); // min ease
  });

  it("marks exercise Mastered after 5 consecutive Good or Easy grades", () => {
    let state = { repetitions: 0, easeFactor: 2.5, intervalDays: 1, lapses: 0, consecutiveSuccesses: 0 };

    for (let i = 1; i <= 4; i++) {
      state = calculateNextReview(state, "Good");
      expect(state.isMastered).toBe(false);
    }

    state = calculateNextReview(state, "Good");
    expect(state.consecutiveSuccesses).toBe(5);
    expect(state.isMastered).toBe(true);
  });

  it("infers grade accurately from attempt metrics", () => {
    expect(inferGrade({ correct: false, hintsUsed: 0, durationMs: 5000 })).toBe("Again");
    expect(inferGrade({ correct: true, hintsUsed: 1, durationMs: 5000 })).toBe("Hard");
    expect(inferGrade({ correct: true, hintsUsed: 0, durationMs: 40000, medianDurationMs: 15000 })).toBe("Hard");
    expect(inferGrade({ correct: true, hintsUsed: 0, durationMs: 12000, medianDurationMs: 15000 })).toBe("Good");
    expect(inferGrade({ correct: true, hintsUsed: 0, durationMs: 5000, medianDurationMs: 15000 })).toBe("Easy");
  });
});

describe("Exercise Generator (Section 3.7)", () => {
  const dummyGame: GameRecord = {
    id: "game-101",
    user_id: "user-101",
    platform: "chesscom",
    external_id: "ext-1",
    fingerprint: "fp-1",
    pgn: "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0",
    white: "makawa7",
    black: "Opponent",
    white_elo: 1205,
    black_elo: 1190,
    user_colour: "white",
    result: "1-0",
    termination: "Checkmate",
    time_control: "600+0",
    time_class: "rapid",
    rated: true,
    played_at: "2026-11-03T12:00:00Z",
    variant: "standard",
    start_fen: null,
    source: "upload",
    moves_count: 7,
    created_at: "2026-11-03T12:00:00Z",
    updated_at: "2026-11-03T12:00:00Z"
  };

  it("generates exercises only for user mistakes meeting eligibility rules", () => {
    const positions: PositionRecord[] = [
      {
        id: "p0",
        game_id: "game-101",
        user_id: "user-101",
        ply: 0,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        score_cp: 20,
        mate_in: null,
        win_probability: 52,
        best_move_san: "e4",
        best_move_uci: "e2e4",
        pv_lines: [
          { rank: 1, uci: "e2e4", san: "e4", scoreCp: 25, mateIn: null, pv: ["e2e4"] },
          { rank: 2, uci: "d2d4", san: "d4", scoreCp: 5, mateIn: null, pv: ["d2d4"] }
        ],
        created_at: "2026-11-03T12:00:00Z"
      },
      {
        id: "p1",
        game_id: "game-101",
        user_id: "user-101",
        ply: 1,
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        move_san: "e4",
        move_uci: "e2e4",
        score_cp: 20,
        mate_in: null,
        win_probability: 52,
        best_move_san: "e5",
        best_move_uci: "e7e5",
        pv_lines: [],
        created_at: "2026-11-03T12:00:00Z"
      },
      {
        id: "p2",
        game_id: "game-101",
        user_id: "user-101",
        ply: 2,
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        move_san: "e5",
        move_uci: "e7e5",
        score_cp: 20,
        mate_in: null,
        win_probability: 52,
        best_move_san: "Nf3",
        best_move_uci: "g1f3",
        pv_lines: [
          { rank: 1, uci: "g1f3", san: "Nf3", scoreCp: 40, mateIn: null, pv: ["g1f3"] },
          { rank: 2, uci: "b1c3", san: "Nc3", scoreCp: -100, mateIn: null, pv: ["b1c3"] }
        ],
        created_at: "2026-11-03T12:00:00Z"
      },
      {
        id: "p3",
        game_id: "game-101",
        user_id: "user-101",
        ply: 3,
        fen: "rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
        move_san: "Bc4",
        move_uci: "f1c4",
        score_cp: -150,
        mate_in: null,
        win_probability: 30,
        best_move_san: "Nc6",
        best_move_uci: "b8c6",
        pv_lines: [],
        created_at: "2026-11-03T12:00:00Z"
      }
    ];

    const reports: MoveAnalysisReport[] = [
      {
        ply: 1,
        mover: "white",
        playedSan: "e4",
        playedUci: "e2e4",
        bestSan: "e4",
        bestUci: "e2e4",
        evalBefore: 52,
        evalAfter: 52,
        loss: 0,
        classification: "best"
      },
      {
        ply: 2,
        mover: "black",
        playedSan: "e5",
        playedUci: "e7e5",
        bestSan: "e5",
        bestUci: "e7e5",
        evalBefore: 48,
        evalAfter: 48,
        loss: 0,
        classification: "best"
      },
      {
        ply: 3,
        mover: "white", // User played White
        playedSan: "Bc4",
        playedUci: "f1c4",
        bestSan: "Nf3",
        bestUci: "g1f3",
        evalBefore: 52,
        evalAfter: 30,
        loss: 22,
        classification: "blunder" // White blunder
      }
    ];

    const { mistakes, exercises } = generateExercisesFromGame({
      game: dummyGame,
      positions,
      reports,
      userColour: "white"
    });

    expect(mistakes.length).toBe(1);
    expect(mistakes[0].engine_class).toBe("blunder");
    expect(mistakes[0].played_san).toBe("Bc4");

    expect(exercises.length).toBe(1);
    const ex = exercises[0];
    expect(ex.user_colour).toBe("white");
    expect(ex.fen).toBe(positions[2].fen);
    expect(ex.blunder_move?.san).toBe("Bc4");
    expect(ex.solutions[0].san).toBe("Nf3");
    expect(ex.difficulty).toBe("easy"); // loss > 20 -> easy
  });

  it("caps exercises at 3 per game and sorts by largest loss", () => {
    const positions: PositionRecord[] = [];
    const reports: MoveAnalysisReport[] = [];

    // Create 5 blunder moves
    for (let i = 1; i <= 5; i++) {
      const ply = i * 2 - 1; // 1, 3, 5, 7, 9 (White moves)
      positions.push({
        id: `pos-${ply - 1}`,
        game_id: "game-101",
        user_id: "user-101",
        ply: ply - 1,
        fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${i}`,
        score_cp: 0,
        mate_in: null,
        win_probability: 50,
        best_move_san: "Nf3",
        best_move_uci: "g1f3",
        pv_lines: [
          { rank: 1, san: "Nf3", uci: "g1f3", scoreCp: 50, mateIn: null, pv: ["g1f3"] },
          { rank: 2, san: "Nc3", uci: "b1c3", scoreCp: -100, mateIn: null, pv: ["b1c3"] }
        ],
        created_at: "2026-11-03T12:00:00Z"
      });
      positions.push({
        id: `pos-${ply}`,
        game_id: "game-101",
        user_id: "user-101",
        ply,
        fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 ${i}`,
        move_san: "a3",
        move_uci: "a2a3",
        score_cp: -100,
        mate_in: null,
        win_probability: 30,
        created_at: "2026-11-03T12:00:00Z"
      });

      reports.push({
        ply,
        mover: "white",
        playedSan: "a3",
        playedUci: "a2a3",
        bestSan: "Nf3",
        bestUci: "g1f3",
        evalBefore: 50,
        evalAfter: 50 - i * 5,
        loss: i * 5, // 5, 10, 15, 20, 25
        classification: "blunder"
      });
    }

    const { exercises } = generateExercisesFromGame({
      game: dummyGame,
      positions,
      reports,
      userColour: "white"
    });

    // Exactly 3 exercises chosen
    expect(exercises.length).toBe(3);
    // Highest losses first: ply 9 (loss 25), ply 7 (loss 20), ply 5 (loss 15)
    expect(exercises[0].blunder_move?.san).toBe("a3");
  });

  it("filters out positions already decided (<10% or >90% win prob)", () => {
    const positions: PositionRecord[] = [
      {
        id: "p0",
        game_id: "game-101",
        user_id: "user-101",
        ply: 0,
        fen: "8/8/8/8/8/8/8/4K2k w - - 0 1",
        score_cp: 2000,
        mate_in: null,
        win_probability: 95, // 95% already decided
        best_move_san: "Kf2",
        best_move_uci: "e1f2",
        pv_lines: [{ rank: 1, san: "Kf2", uci: "e1f2", scoreCp: 2000, mateIn: null, pv: ["e1f2"] }],
        created_at: "2026-11-03T12:00:00Z"
      },
      {
        id: "p1",
        game_id: "game-101",
        user_id: "user-101",
        ply: 1,
        fen: "8/8/8/8/8/8/8/4K2k b - - 0 1",
        move_san: "Kf1",
        move_uci: "e1f1",
        score_cp: 1000,
        mate_in: null,
        win_probability: 80,
        created_at: "2026-11-03T12:00:00Z"
      }
    ];

    const reports: MoveAnalysisReport[] = [
      {
        ply: 1,
        mover: "white",
        playedSan: "Kf1",
        playedUci: "e1f1",
        bestSan: "Kf2",
        bestUci: "e1f2",
        evalBefore: 95, // > 90%
        evalAfter: 80,
        loss: 15,
        classification: "blunder"
      }
    ];

    const { exercises } = generateExercisesFromGame({
      game: dummyGame,
      positions,
      reports,
      userColour: "white"
    });

    expect(exercises.length).toBe(0); // rejected by rule 3
  });
});

describe("Data Export Sovereignty (FR-112)", () => {
  const games: GameRecord[] = [
    {
      id: "g1",
      platform: "chesscom",
      fingerprint: "fp1",
      pgn: '[Event "Game 1"]\n1. e4 e5 1-0',
      white: "Alice",
      black: "Bob",
      result: "1-0",
      moves_count: 2,
      source: "upload"
    },
    {
      id: "g2",
      platform: "lichess",
      fingerprint: "fp2",
      pgn: '[Event "Game 2"]\n1. d4 d5 0-1',
      white: "Bob",
      black: "Charlie",
      result: "0-1",
      moves_count: 2,
      source: "upload"
    }
  ];

  it("exports all games as clean concatenated PGN", () => {
    const pgn = exportGamesToPgn(games);
    expect(pgn).toContain('[Event "Game 1"]');
    expect(pgn).toContain('1. e4 e5 1-0');
    expect(pgn).toContain('[Event "Game 2"]');
    expect(pgn).toContain('1. d4 d5 0-1');
  });

  it("exports comprehensive backup as JSON", () => {
    const jsonStr = exportAllDataAsJson(games);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.appName).toBe("ChessForge");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.games.length).toBe(2);
    expect(Array.isArray(parsed.mistakes)).toBe(true);
    expect(Array.isArray(parsed.exercises)).toBe(true);
    expect(Array.isArray(parsed.schedule)).toBe(true);
  });
});

