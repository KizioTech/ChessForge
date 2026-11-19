import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordAttemptAndAdvanceSchedule, saveGeneratedExercises } from "../../src/lib/training/training-service";
import { calculateNextReview, SM2_DEFAULTS } from "../../src/lib/training/sm2";
import type { TrainingExerciseRecord, ReviewScheduleRecord } from "../../src/lib/training/types";

describe("PR A - Correctness & SM-2 Mastery Tracking (Item 1.1)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }
    });
  });

  it("SM-2 increments consecutiveSuccesses on Good and resets on Again", () => {
    let state = {
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      lapses: 0,
      consecutiveSuccesses: 0
    };

    const res1 = calculateNextReview(state, "Good");
    expect(res1.consecutiveSuccesses).toBe(1);
    expect(res1.isMastered).toBe(false);

    state = { ...state, consecutiveSuccesses: res1.consecutiveSuccesses };
    const res2 = calculateNextReview(state, "Again");
    expect(res2.consecutiveSuccesses).toBe(0);
    expect(res2.isMastered).toBe(false);
  });

  it("advances schedule and triggers mastery after 5 consecutive Good attempts", async () => {
    const exercise: TrainingExerciseRecord = {
      id: "ex-mastery-test-1",
      user_id: "00000000-0000-0000-0000-000000000001",
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      user_colour: "white",
      exercise_type: "attack",
      prompt: "Find the best move",
      solutions: [{ san: "e4", uci: "e2e4" }],
      themes: ["opening"],
      difficulty: "easy",
      status: "active"
    };

    // Save exercise initially with default schedule
    saveGeneratedExercises([], [exercise], "00000000-0000-0000-0000-000000000001", { skipRemoteSync: true });

    let isMastered = false;
    for (let i = 1; i <= 5; i++) {
      const result = await recordAttemptAndAdvanceSchedule(
        exercise,
        {
          correct: true,
          durationMs: 3000,
          hintsUsed: 0,
          movesTried: ["e4"],
          grade: "Good"
        },
        "00000000-0000-0000-0000-000000000001"
      );
      expect(result.schedule.consecutive_successes).toBe(i);
      isMastered = result.isMastered;
      if (i < 5) {
        expect(isMastered).toBe(false);
      }
    }

    // On 5th consecutive Good grade, it should be mastered!
    expect(isMastered).toBe(true);

    // Verify localStorage has status: mastered
    const stored = JSON.parse(localStorage.getItem("chessforge:exercises") || "[]");
    const updatedEx = stored.find((e: TrainingExerciseRecord) => e.id === exercise.id);
    expect(updatedEx.status).toBe("mastered");
  });
});
