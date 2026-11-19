/**
 * training-service.ts — Persistence and retrieval for mistakes, exercises, and review schedule.
 *
 * Implements dual-layer storage (Supabase + LocalStorage fallback) adhering to ADR 0002 & ADR 0009.
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import { remote } from "../remote";
import type {
  TrainingExerciseRecord,
  MistakeRecord,
  ReviewScheduleRecord,
  ExerciseAttemptRecord,
  ExerciseWithSchedule,
  ExerciseGrade
} from "./types";
import { calculateNextReview, SM2_DEFAULTS } from "./sm2";

export const LOCAL_GUEST_USER_ID = "00000000-0000-0000-0000-000000000000";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRealUuid(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// ── LocalStorage keys ────────────────────────────────────────────────────────
const LS_MISTAKES = "chessforge:mistakes";
const LS_EXERCISES = "chessforge:exercises";
const LS_SCHEDULE = "chessforge:schedule";
const LS_ATTEMPTS = "chessforge:attempts";

function getLocal<T>(key: string): T[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, items: T[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`Failed to write ${key} to localStorage:`, err);
  }
}

/**
 * Save newly generated mistakes and exercises, initializing their SM-2 review schedules.
 */
export async function saveGeneratedExercises(
  mistakes: MistakeRecord[],
  exercises: TrainingExerciseRecord[],
  userId?: string,
  options?: { skipRemoteSync?: boolean }
): Promise<{ exercises: TrainingExerciseRecord[]; schedule: ReviewScheduleRecord[] }> {
  const nowIso = new Date().toISOString();

  // 1. Build initial review schedules for exercises
  const schedules: ReviewScheduleRecord[] = exercises.map(ex => ({
    exercise_id: ex.id,
    user_id: ex.user_id || userId || LOCAL_GUEST_USER_ID,
    due_at: nowIso,
    interval_days: 1.0,
    ease_factor: SM2_DEFAULTS.INITIAL_EASE,
    repetitions: 0,
    lapses: 0,
    consecutive_successes: 0,
    created_at: nowIso,
    updated_at: nowIso
  }));

  // 2. LocalStorage dual-layer persistence (instant offline cache)
  const existingExercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
  const exerciseMap = new Map<string, TrainingExerciseRecord>();
  existingExercises.forEach(e => exerciseMap.set(e.id, e));
  exercises.forEach(e => exerciseMap.set(e.id, e));
  saveLocal(LS_EXERCISES, Array.from(exerciseMap.values()));

  const existingSchedule = getLocal<ReviewScheduleRecord>(LS_SCHEDULE);
  const scheduleMap = new Map<string, ReviewScheduleRecord>();
  existingSchedule.forEach(s => scheduleMap.set(s.exercise_id, s));
  schedules.forEach(s => scheduleMap.set(s.exercise_id, s));
  saveLocal(LS_SCHEDULE, Array.from(scheduleMap.values()));

  const existingMistakes = getLocal<MistakeRecord>(LS_MISTAKES);
  const mistakeMap = new Map<string, MistakeRecord>();
  existingMistakes.forEach(m => mistakeMap.set(m.id, m));
  mistakes.forEach(m => mistakeMap.set(m.id, { ...m, source: "stockfish" }));
  saveLocal(LS_MISTAKES, Array.from(mistakeMap.values()));

  // 3. Remote Supabase persistence (if authenticated with UUID and not skipped)
  if (!options?.skipRemoteSync && userId && isRealUuid(userId)) {
    if (mistakes.length > 0) {
      const remoteMistakes = mistakes
        .filter(m => isRealUuid(m.game_id))
        .map(m => ({
          ...m,
          id: isRealUuid(m.id) ? m.id : undefined,
          position_id: isRealUuid(m.position_id) ? m.position_id : null,
          user_id: userId
        }));
      if (remoteMistakes.length > 0) {
        const r = await remote(
          s => supabase.from("mistakes").upsert(remoteMistakes).abortSignal(s).select(),
          { label: "training.mistakes.upsert" }
        );
        if (!r.ok) {
          console.warn("Remote mistakes upsert failed:", r.message);
        }
      }
    }

    if (exercises.length > 0) {
      const remoteExercises = exercises
        .filter(e => isRealUuid(e.game_id || ""))
        .map(e => ({
          ...e,
          id: isRealUuid(e.id) ? e.id : undefined,
          mistake_id: isRealUuid(e.mistake_id) ? e.mistake_id : null,
          user_id: userId
        }));
      if (remoteExercises.length > 0) {
        const r = await remote(
          s => supabase.from("training_exercises").upsert(remoteExercises).abortSignal(s).select(),
          { label: "training.exercises.upsert" }
        );
        if (!r.ok) {
          console.warn("Remote exercises upsert failed:", r.message);
        }
      }
    }

    const remoteSchedules = schedules
      .filter(s => isRealUuid(s.exercise_id))
      .map(s => ({ ...s, user_id: userId }));
    if (remoteSchedules.length > 0) {
      const r = await remote(
        s => supabase.from("review_schedule").upsert(remoteSchedules).abortSignal(s).select(),
        { label: "training.schedule.upsert" }
      );
      if (!r.ok) {
        console.warn("Remote schedule upsert failed:", r.message);
      }
    }
  }

  return { exercises, schedule: schedules };
}

/**
 * Asynchronously synchronizes accumulated local mistakes and exercises to Supabase in the background.
 */
export async function syncLocalTrainingToSupabase(userId?: string): Promise<void> {
  if (!isSupabaseConfigured || !userId || !isRealUuid(userId)) return;

  const allMistakes = getLocal<MistakeRecord>(LS_MISTAKES);
  const allExercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);

  // Only upload real engine-verified mistakes (source === "stockfish")
  const validMistakes = allMistakes
    .filter(m => isRealUuid(m.game_id) && m.source !== "heuristic")
    .map(m => ({
      ...m,
      id: isRealUuid(m.id) ? m.id : undefined,
      position_id: isRealUuid(m.position_id) ? m.position_id : null,
      user_id: userId
    }));

  if (validMistakes.length > 0) {
    const r = await remote(
      s => supabase.from("mistakes").upsert(validMistakes).abortSignal(s).select(),
      { label: "sync.mistakes.upsert" }
    );
    if (!r.ok) {
      console.warn("Background training sync (mistakes) failed:", r.message);
    }
  }

  const validExercises = allExercises
    .filter(e => isRealUuid(e.game_id || ""))
    .map(e => ({
      ...e,
      id: isRealUuid(e.id) ? e.id : undefined,
      mistake_id: isRealUuid(e.mistake_id) ? e.mistake_id : null,
      user_id: userId
    }));

  if (validExercises.length > 0) {
    const r = await remote(
      s => supabase.from("training_exercises").upsert(validExercises).abortSignal(s).select(),
      { label: "sync.exercises.upsert" }
    );
    if (!r.ok) {
      console.warn("Background training sync (exercises) failed:", r.message);
    }
  }
}

/**
 * Retrieve exercises currently due for review according to SM-2 schedule.
 */
export async function getDueExercises(
  userId?: string,
  limit: number = 10
): Promise<ExerciseWithSchedule[]> {
  const now = new Date();
  const allExercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
  const allSchedules = getLocal<ReviewScheduleRecord>(LS_SCHEDULE);

  const scheduleMap = new Map<string, ReviewScheduleRecord>();
  allSchedules.forEach(s => scheduleMap.set(s.exercise_id, s));

  // Filter exercises that are active and due
  const dueList: ExerciseWithSchedule[] = [];

  for (const ex of allExercises) {
    if (ex.status !== "active") continue;
    const sched = scheduleMap.get(ex.id);
    if (!sched) continue;

    const dueTime = new Date(sched.due_at).getTime();
    if (dueTime <= now.getTime() + 60000) { // allow 1 min tolerance
      dueList.push({
        ...ex,
        schedule: sched
      });
    }
  }

  // Sort by due date ascending (most overdue first)
  dueList.sort((a, b) => {
    const timeA = a.schedule ? new Date(a.schedule.due_at).getTime() : 0;
    const timeB = b.schedule ? new Date(b.schedule.due_at).getTime() : 0;
    return timeA - timeB;
  });

  return dueList.slice(0, limit);
}

/**
 * Record an exercise solving attempt and advance the SM-2 schedule.
 */
export async function recordAttemptAndAdvanceSchedule(
  exercise: TrainingExerciseRecord,
  attempt: {
    correct: boolean;
    durationMs: number;
    hintsUsed: number;
    movesTried: string[];
    grade: ExerciseGrade;
  },
  userId?: string
): Promise<{ schedule: ReviewScheduleRecord; isMastered: boolean }> {
  const now = new Date();
  const allSchedules = getLocal<ReviewScheduleRecord>(LS_SCHEDULE);
  const currentSched = allSchedules.find(s => s.exercise_id === exercise.id);

  const sm2Result = calculateNextReview(
    {
      repetitions: currentSched?.repetitions ?? 0,
      easeFactor: currentSched?.ease_factor ?? SM2_DEFAULTS.INITIAL_EASE,
      intervalDays: currentSched?.interval_days ?? 1,
      lapses: currentSched?.lapses ?? 0,
      consecutiveSuccesses: currentSched?.consecutive_successes ?? 0
    },
    attempt.grade,
    now
  );

  const updatedSched: ReviewScheduleRecord = {
    exercise_id: exercise.id,
    user_id: currentSched?.user_id || userId || LOCAL_GUEST_USER_ID,
    due_at: sm2Result.dueAt.toISOString(),
    interval_days: sm2Result.intervalDays,
    ease_factor: sm2Result.easeFactor,
    repetitions: sm2Result.repetitions,
    lapses: sm2Result.lapses,
    consecutive_successes: sm2Result.consecutiveSuccesses,
    last_reviewed_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  // Update schedule locally
  const newSchedules = allSchedules.filter(s => s.exercise_id !== exercise.id);
  newSchedules.push(updatedSched);
  saveLocal(LS_SCHEDULE, newSchedules);

  // If mastered, update exercise status
  if (sm2Result.isMastered) {
    const allExercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
    const updatedExercises = allExercises.map(e =>
      e.id === exercise.id ? { ...e, status: "mastered" as const } : e
    );
    saveLocal(LS_EXERCISES, updatedExercises);
  }

  // Save attempt
  const attempts = getLocal<ExerciseAttemptRecord>(LS_ATTEMPTS);
  attempts.push({
    exercise_id: exercise.id,
    user_id: userId || LOCAL_GUEST_USER_ID,
    attempted_at: now.toISOString(),
    correct: attempt.correct,
    duration_ms: attempt.durationMs,
    hints_used: attempt.hintsUsed,
    moves_tried: attempt.movesTried,
    grade: attempt.grade
  });
  saveLocal(LS_ATTEMPTS, attempts);

  // Remote update if authenticated
  if (userId && isRealUuid(userId) && isRealUuid(exercise.id)) {
    const rSched = await remote(
      s => supabase.from("review_schedule").upsert(updatedSched).abortSignal(s).select(),
      { label: "attempt.schedule.upsert" }
    );
    if (!rSched.ok) {
      console.warn("Remote schedule update failed:", rSched.message);
    }

    if (sm2Result.isMastered) {
      const rEx = await remote(
        s => supabase.from("training_exercises").update({ status: "mastered" }).eq("id", exercise.id).abortSignal(s).select(),
        { label: "attempt.exercise.mastered" }
      );
      if (!rEx.ok) {
        console.warn("Remote exercise mastery update failed:", rEx.message);
      }
    }

    const rAttempt = await remote(
      s => supabase.from("exercise_attempts").insert({
        exercise_id: exercise.id,
        user_id: userId,
        correct: attempt.correct,
        duration_ms: attempt.durationMs,
        hints_used: attempt.hintsUsed,
        moves_tried: attempt.movesTried,
        grade: attempt.grade
      }).abortSignal(s).select(),
      { label: "attempt.insert" }
    );
    if (!rAttempt.ok) {
      console.warn("Remote attempt insert failed:", rAttempt.message);
    }
  }

  return { schedule: updatedSched, isMastered: sm2Result.isMastered };
}

/**
 * Flag an exercise as bad or unwanted (removes from active queue).
 */
export async function flagExercise(
  exerciseId: string,
  reason: string,
  userId?: string
): Promise<void> {
  const allExercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
  const updated = allExercises.map(e =>
    e.id === exerciseId
      ? { ...e, status: "flagged" as const, flag_reason: reason }
      : e
  );
  saveLocal(LS_EXERCISES, updated);

  if (userId && isRealUuid(userId) && isRealUuid(exerciseId)) {
    const r = await remote(
      s => supabase.from("training_exercises").update({ status: "flagged", flag_reason: reason }).eq("id", exerciseId).abortSignal(s).select(),
      { label: "flagExercise" }
    );
    if (!r.ok) {
      console.warn("Remote flag exercise failed:", r.message);
    }
  }
}

/**
 * Aggregate summary metrics for dashboard and review desk.
 */
export interface TrainingStats {
  dueCount: number;
  totalActive: number;
  masteredCount: number;
  streakDays: number;
  blundersPer100Moves: number;
}

export function getTrainingStats(userId?: string): TrainingStats {
  const exercises = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
  const schedules = getLocal<ReviewScheduleRecord>(LS_SCHEDULE);
  const mistakes = getLocal<MistakeRecord>(LS_MISTAKES);
  const attempts = getLocal<ExerciseAttemptRecord>(LS_ATTEMPTS);

  const now = Date.now();
  let dueCount = 0;
  for (const s of schedules) {
    if (new Date(s.due_at).getTime() <= now) {
      const ex = exercises.find(e => e.id === s.exercise_id);
      if (ex && ex.status === "active") {
        dueCount++;
      }
    }
  }

  const totalActive = exercises.filter(e => e.status === "active").length;
  const masteredCount = exercises.filter(e => e.status === "mastered").length;

  // Streak: count distinct consecutive calendar days with at least 1 attempt
  const attemptDays = new Set(
    attempts.map(a => a.attempted_at?.substring(0, 10)).filter(Boolean)
  );

  let streakDays = 0;
  const checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().substring(0, 10);
    if (attemptDays.has(dateStr)) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Check if today was missed but yesterday was active
      if (streakDays === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yestStr = checkDate.toISOString().substring(0, 10);
        if (attemptDays.has(yestStr)) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  // Blunders per 100 moves calculation across analyzed games
  const blunders = mistakes.filter(m => m.engine_class === "blunder").length;
  // Estimate total plies from mistakes (if any) or baseline
  const blundersPer100Moves =
    mistakes.length > 0
      ? Math.round((blunders / (mistakes.length * 1.5)) * 100 * 10) / 10
      : 0;

  return {
    dueCount,
    totalActive,
    masteredCount,
    streakDays,
    blundersPer100Moves
  };
}

// ── Item 1.5: Training Cloud Hydration ───────────────────────────────────────

export interface HydrationResult {
  exercisesMerged: number;
  schedulesMerged: number;
  attemptsMerged: number;
}

/**
 * Pull the authenticated user's training state from Supabase and merge it into
 * local storage, keeping the most-recently-updated record when duplicates exist.
 *
 * Call on:
 *  - Login (user just authenticated on this device)
 *  - App-focus restore after the window was hidden (window "visibilitychange" → visible)
 *
 * Strategy:
 *  - Fetch up to 1 000 exercises, schedules, and 500 recent attempts.
 *  - For exercises: remote wins when remote.updated_at > local.updated_at.
 *  - For schedules: remote wins when remote.last_reviewed_at > local.last_reviewed_at.
 *  - For attempts: insert any remote attempt whose exercise_id+attempted_at pair is absent locally.
 *  - Always a no-op when Supabase is not configured or userId is not a real UUID.
 */
export async function pullTrainingState(
  userId: string
): Promise<HydrationResult> {
  const result: HydrationResult = {
    exercisesMerged: 0,
    schedulesMerged: 0,
    attemptsMerged: 0
  };

  if (!isSupabaseConfigured || !isRealUuid(userId)) return result;

  // ── 1. Exercises ─────────────────────────────────────────────────────────
  const rEx = await remote<TrainingExerciseRecord[]>(
    s =>
      supabase
        .from("training_exercises")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1000)
        .abortSignal(s) as any,
    { label: "hydration.exercises", timeoutMs: 12000 }
  );

  if (rEx.ok && Array.isArray(rEx.data)) {
    const local = getLocal<TrainingExerciseRecord>(LS_EXERCISES);
    const localMap = new Map<string, TrainingExerciseRecord>(
      local.map(e => [e.id, e])
    );

    for (const remote of rEx.data) {
      const existing = localMap.get(remote.id);
      const remoteTime = remote.updated_at ?? "0";
      const localTime = existing?.updated_at ?? "0";
      if (!existing || remoteTime > localTime) {
        localMap.set(remote.id, remote);
        result.exercisesMerged++;
      }
    }

    saveLocal(LS_EXERCISES, Array.from(localMap.values()));
  }

  // ── 2. Review schedules ───────────────────────────────────────────────────
  const rSched = await remote<ReviewScheduleRecord[]>(
    s =>
      supabase
        .from("review_schedule")
        .select("*")
        .eq("user_id", userId)
        .order("last_reviewed_at", { ascending: false })
        .limit(1000)
        .abortSignal(s) as any,
    { label: "hydration.schedule", timeoutMs: 12000 }
  );

  if (rSched.ok && Array.isArray(rSched.data)) {
    const local = getLocal<ReviewScheduleRecord>(LS_SCHEDULE);
    const localMap = new Map<string, ReviewScheduleRecord>(
      local.map(s => [s.exercise_id, s])
    );

    for (const remote of rSched.data) {
      const existing = localMap.get(remote.exercise_id);
      const remoteTime = remote.last_reviewed_at ?? remote.updated_at ?? "0";
      const localTime =
        existing?.last_reviewed_at ?? existing?.updated_at ?? "0";
      if (!existing || remoteTime > localTime) {
        localMap.set(remote.exercise_id, remote);
        result.schedulesMerged++;
      }
    }

    saveLocal(LS_SCHEDULE, Array.from(localMap.values()));
  }

  // ── 3. Exercise attempts (last 500) ───────────────────────────────────────
  const rAttempts = await remote<ExerciseAttemptRecord[]>(
    s =>
      supabase
        .from("exercise_attempts")
        .select("*")
        .eq("user_id", userId)
        .order("attempted_at", { ascending: false })
        .limit(500)
        .abortSignal(s) as any,
    { label: "hydration.attempts", timeoutMs: 12000 }
  );

  if (rAttempts.ok && Array.isArray(rAttempts.data)) {
    const local = getLocal<ExerciseAttemptRecord>(LS_ATTEMPTS);
    // Dedup key: exercise_id + attempted_at
    const localKeys = new Set<string>(
      local.map(a => `${a.exercise_id}|${a.attempted_at ?? ""}`)
    );

    const toAdd: ExerciseAttemptRecord[] = [];
    for (const remote of rAttempts.data) {
      const key = `${remote.exercise_id}|${remote.attempted_at ?? ""}`;
      if (!localKeys.has(key)) {
        toAdd.push(remote);
        localKeys.add(key);
        result.attemptsMerged++;
      }
    }

    if (toAdd.length > 0) {
      saveLocal(LS_ATTEMPTS, [...local, ...toAdd]);
    }
  }

  return result;
}

/** localStorage key used to gate once-per-session hydration. */
const LS_HYDRATION_SESSION_KEY = "chessforge:hydration_session";

/**
 * Returns true when pullTrainingState should be called (once per browser/Electron
 * session per userId, or whenever the userId changes).
 */
export function isHydrationDue(userId: string): boolean {
  try {
    const stored = sessionStorage.getItem(LS_HYDRATION_SESSION_KEY);
    return stored !== userId;
  } catch {
    return true;
  }
}

/** Mark hydration as done for this session. */
export function markHydrationDone(userId: string): void {
  try {
    sessionStorage.setItem(LS_HYDRATION_SESSION_KEY, userId);
  } catch {
    /* ignore */
  }
}

