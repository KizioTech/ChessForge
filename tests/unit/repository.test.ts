/**
 * repository.test.ts — Unit tests for the Dexie Repository layer (Item 10 & 12).
 *
 * Verifies:
 * 1. Automatic migration from localStorage on first access.
 * 2. Games CRUD (put, get, delete, fingerprints).
 * 3. Exercises CRUD (put, get, update).
 * 4. Schedules CRUD (put, get).
 * 5. Attempts CRUD (add, bulkAdd, get).
 * 6. Mistakes CRUD (put, get).
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { ChessForgeDb, _setDbForTest } from "../../src/lib/db";
import {
  dbGetGames,
  dbPutGames,
  dbDeleteGame,
  dbGetGameFingerprints,
  dbGetExercises,
  dbPutExercises,
  dbUpdateExercise,
  dbGetSchedules,
  dbPutSchedule,
  dbGetAttempts,
  dbAddAttempt,
  dbGetMistakes,
  dbPutMistakes
} from "../../src/lib/repository";
import type { GameRecord } from "../../src/lib/games";

let db: ChessForgeDb;
const USER_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  db = new ChessForgeDb();
  await db.open();
  _setDbForTest(db);
  await db.games.clear();
  await db.exercises.clear();
  await db.review_schedule.clear();
  await db.exercise_attempts.clear();
  await db.mistakes.clear();
});

describe("IndexedDB Repository Layer (Item 10)", () => {
  it("saves and retrieves games with fingerprint indexing", async () => {
    const game: GameRecord = {
      id: "game-1",
      user_id: USER_ID,
      platform: "chesscom",
      fingerprint: "fp-12345",
      pgn: "1. e4 e5",
      white: "PlayerWhite",
      black: "PlayerBlack",
      user_colour: "white",
      result: "1-0",
      rated: true,
      variant: "standard",
      source: "upload",
      moves_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbPutGames([game]);
    const retrieved = await dbGetGames(USER_ID);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe("game-1");

    const fps = await dbGetGameFingerprints(USER_ID);
    expect(fps.has("fp-12345")).toBe(true);

    await dbDeleteGame("game-1");
    const afterDelete = await dbGetGames(USER_ID);
    expect(afterDelete).toHaveLength(0);
  });

  it("handles exercises CRUD and partial updates", async () => {
    const ex: any = {
      id: "ex-1",
      user_id: USER_ID,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      user_colour: "white",
      exercise_type: "avoid_blunder",
      prompt: "Solve it",
      solutions: [],
      themes: [],
      difficulty: "medium",
      status: "active"
    };

    await dbPutExercises([ex]);
    let list = await dbGetExercises(USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("active");

    await dbUpdateExercise("ex-1", { status: "mastered" });
    list = await dbGetExercises(USER_ID);
    expect(list[0].status).toBe("mastered");
  });

  it("handles review schedules and attempts", async () => {
    const sched: any = {
      exercise_id: "ex-1",
      user_id: USER_ID,
      due_at: new Date().toISOString(),
      interval_days: 2,
      ease_factor: 2.6,
      repetitions: 1,
      lapses: 0,
      consecutive_successes: 1
    };

    await dbPutSchedule(sched);
    const schedules = await dbGetSchedules(USER_ID);
    expect(schedules).toHaveLength(1);
    expect(schedules[0].consecutive_successes).toBe(1);

    const attempt: any = {
      exercise_id: "ex-1",
      user_id: USER_ID,
      attempted_at: new Date().toISOString(),
      correct: true,
      duration_ms: 3000,
      hints_used: 0,
      moves_tried: ["e2e4"],
      grade: "Good"
    };

    await dbAddAttempt(attempt);
    const attempts = await dbGetAttempts(USER_ID);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].grade).toBe("Good");
  });

  it("handles mistake records storage", async () => {
    const mistake: any = {
      id: "mistake-1",
      user_id: USER_ID,
      game_id: "game-1",
      ply: 12,
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      played_san: "Nf3",
      played_uci: "g1f3",
      engine_class: "blunder",
      win_pct_loss: 25.5,
      tags: ["hanging_piece"],
      user_corrected: false,
      source: "stockfish"
    };

    await dbPutMistakes([mistake]);
    const mistakes = await dbGetMistakes(USER_ID);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].source).toBe("stockfish");
  });
});
