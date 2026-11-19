/**
 * training-hydration.test.ts — Unit tests for Item 1.5: Training Cloud Hydration.
 *
 * Tests pullTrainingState(), isHydrationDue(), and markHydrationDone():
 *
 * 1. Hydration merges remote exercises into localStorage (remote wins when newer).
 * 2. Hydration does NOT overwrite a local exercise that is more recently updated.
 * 3. Hydration merges schedules by last_reviewed_at (remote wins when newer).
 * 4. Hydration inserts new remote attempts (by exercise_id+attempted_at key).
 * 5. Hydration skips duplicate attempts already present locally.
 * 6. Hydration is a no-op when Supabase is not configured.
 * 7. isHydrationDue() / markHydrationDone() gate on sessionStorage per userId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase ─────────────────────────────────────────────────────────────
let _mockExercises: any[] = [];
let _mockSchedules: any[] = [];
let _mockAttempts: any[] = [];
let _supabaseConfigured = true;

vi.mock("../../src/lib/supabase", () => ({
  get isSupabaseConfigured() { return _supabaseConfigured; },
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              abortSignal: () =>
                Promise.resolve({
                  data:
                    table === "training_exercises"
                      ? _mockExercises
                      : table === "review_schedule"
                      ? _mockSchedules
                      : _mockAttempts,
                  error: null
                })
            })
          })
        })
      })
    })
  }
}));

// ── Fake localStorage / sessionStorage ───────────────────────────────────────
const localStore: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: (k: string) => localStore[k] ?? null,
  setItem: (k: string, v: string) => { localStore[k] = v; },
  removeItem: (k: string) => { delete localStore[k]; }
});
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => sessionStore[k] ?? null,
  setItem: (k: string, v: string) => { sessionStore[k] = v; },
  removeItem: (k: string) => { delete sessionStore[k]; }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeExercise(id: string, updatedAt: string, status = "active") {
  return {
    id,
    user_id: "user-1",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    user_colour: "white",
    exercise_type: "avoid_blunder",
    prompt: "Find the best move",
    solutions: [],
    themes: [],
    difficulty: "medium",
    status,
    updated_at: updatedAt
  };
}

function makeSchedule(exerciseId: string, lastReviewed: string | null) {
  return {
    exercise_id: exerciseId,
    user_id: "user-1",
    due_at: new Date().toISOString(),
    interval_days: 1,
    ease_factor: 2.5,
    repetitions: 0,
    lapses: 0,
    consecutive_successes: 0,
    last_reviewed_at: lastReviewed,
    updated_at: lastReviewed ?? new Date().toISOString()
  };
}

function makeAttempt(exerciseId: string, attemptedAt: string, correct = true) {
  return {
    exercise_id: exerciseId,
    user_id: "user-1",
    attempted_at: attemptedAt,
    correct,
    duration_ms: 5000,
    hints_used: 0,
    moves_tried: [],
    grade: "Good"
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
import {
  pullTrainingState,
  isHydrationDue,
  markHydrationDone
} from "../../src/lib/training/training-service";

const USER_ID = "a1b2c3d4-e5f6-4a5b-9c0d-1e2f3a4b5c6d";
const LS_EXERCISES = "chessforge:exercises";
const LS_SCHEDULE = "chessforge:schedule";
const LS_ATTEMPTS = "chessforge:attempts";

beforeEach(() => {
  // Clear stores between tests
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
  _mockExercises = [];
  _mockSchedules = [];
  _mockAttempts = [];
  _supabaseConfigured = true;
});

describe("pullTrainingState()", () => {
  it("merges remote exercises into localStorage — remote wins when newer", async () => {
    const local = makeExercise("ex-1", "2026-01-01T00:00:00Z");
    localStore[LS_EXERCISES] = JSON.stringify([local]);

    const remote = makeExercise("ex-1", "2026-06-01T00:00:00Z", "mastered");
    _mockExercises = [remote];

    const result = await pullTrainingState(USER_ID);

    expect(result.exercisesMerged).toBe(1);
    const saved = JSON.parse(localStore[LS_EXERCISES]);
    expect(saved[0].status).toBe("mastered");
  });

  it("does NOT overwrite a local exercise that is more recently updated", async () => {
    const local = makeExercise("ex-2", "2026-12-01T00:00:00Z", "mastered");
    localStore[LS_EXERCISES] = JSON.stringify([local]);

    const remote = makeExercise("ex-2", "2026-01-01T00:00:00Z", "active");
    _mockExercises = [remote];

    const result = await pullTrainingState(USER_ID);

    expect(result.exercisesMerged).toBe(0);
    const saved = JSON.parse(localStore[LS_EXERCISES]);
    expect(saved[0].status).toBe("mastered"); // local preserved
  });

  it("inserts brand-new remote exercises not present locally", async () => {
    _mockExercises = [makeExercise("ex-new", "2026-06-01T00:00:00Z")];

    const result = await pullTrainingState(USER_ID);

    expect(result.exercisesMerged).toBe(1);
    const saved = JSON.parse(localStore[LS_EXERCISES]);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("ex-new");
  });

  it("merges schedules — remote wins when last_reviewed_at is newer", async () => {
    const localSched = makeSchedule("ex-1", "2026-01-01T00:00:00Z");
    localStore[LS_SCHEDULE] = JSON.stringify([localSched]);

    _mockSchedules = [makeSchedule("ex-1", "2026-11-01T00:00:00Z")];

    const result = await pullTrainingState(USER_ID);

    expect(result.schedulesMerged).toBe(1);
    const saved = JSON.parse(localStore[LS_SCHEDULE]);
    expect(saved[0].last_reviewed_at).toBe("2026-11-01T00:00:00Z");
  });

  it("does NOT overwrite a local schedule that was reviewed more recently", async () => {
    const localSched = makeSchedule("ex-1", "2026-11-19T00:00:00Z");
    localStore[LS_SCHEDULE] = JSON.stringify([localSched]);

    _mockSchedules = [makeSchedule("ex-1", "2026-01-01T00:00:00Z")];

    const result = await pullTrainingState(USER_ID);

    expect(result.schedulesMerged).toBe(0);
  });

  it("appends new remote attempts not already present locally", async () => {
    const existing = makeAttempt("ex-1", "2026-01-01T10:00:00Z");
    localStore[LS_ATTEMPTS] = JSON.stringify([existing]);

    _mockAttempts = [
      makeAttempt("ex-1", "2026-01-01T10:00:00Z"), // duplicate — should be skipped
      makeAttempt("ex-1", "2026-11-01T10:00:00Z")  // new — should be added
    ];

    const result = await pullTrainingState(USER_ID);

    expect(result.attemptsMerged).toBe(1);
    const saved = JSON.parse(localStore[LS_ATTEMPTS]);
    expect(saved).toHaveLength(2);
  });

  it("is a no-op when Supabase is not configured", async () => {
    _supabaseConfigured = false;
    _mockExercises = [makeExercise("ex-1", "2026-06-01T00:00:00Z")];

    const result = await pullTrainingState(USER_ID);

    expect(result.exercisesMerged).toBe(0);
    expect(result.schedulesMerged).toBe(0);
    expect(result.attemptsMerged).toBe(0);
    expect(localStore[LS_EXERCISES]).toBeUndefined();
  });

  it("is a no-op for non-UUID userIds (guest mode)", async () => {
    _mockExercises = [makeExercise("ex-1", "2026-06-01T00:00:00Z")];

    const result = await pullTrainingState("guest-user");

    expect(result.exercisesMerged).toBe(0);
  });
});

describe("isHydrationDue() / markHydrationDone()", () => {
  it("returns true when no session marker exists", () => {
    expect(isHydrationDue(USER_ID)).toBe(true);
  });

  it("returns false after markHydrationDone() for the same userId", () => {
    markHydrationDone(USER_ID);
    expect(isHydrationDue(USER_ID)).toBe(false);
  });

  it("returns true for a different userId even after marking done", () => {
    markHydrationDone(USER_ID);
    expect(isHydrationDue("different-user-id")).toBe(true);
  });
});
