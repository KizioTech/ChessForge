/**
 * training-service.ts — Persistence and retrieval for mistakes, exercises, and review schedule.
 *
 * Implements dual-layer storage (Supabase + LocalStorage fallback) adhering to ADR 0002 & ADR 0009.
 */

import { supabase } from "../supabase";
import type {
  TrainingExerciseRecord,
  MistakeRecord,
  ReviewScheduleRecord,
  ExerciseAttemptRecord,
  ExerciseWithSchedule,
  ExerciseGrade
} from "./types";
import { calculateNextReview, SM2_DEFAULTS } from "./sm2";

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
  userId?: string
): Promise<{ exercises: TrainingExerciseRecord[]; schedule: ReviewScheduleRecord[] }> {
  const nowIso = new Date().toISOString();

  // 1. Build initial review schedules for exercises
  const schedules: ReviewScheduleRecord[] = exercises.map(ex => ({
    exercise_id: ex.id,
    user_id: ex.user_id || userId || "local",
    due_at: nowIso,
    interval_days: 1.0,
    ease_factor: SM2_DEFAULTS.INITIAL_EASE,
    repetitions: 0,
    lapses: 0,
    created_at: nowIso,
    updated_at: nowIso
  }));

  // 2. LocalStorage dual-layer persistence
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
  mistakes.forEach(m => mistakeMap.set(m.id, m));
  saveLocal(LS_MISTAKES, Array.from(mistakeMap.values()));

  // 3. Remote Supabase persistence (if authenticated with UUID)
  if (userId && isRealUuid(userId)) {
    try {
      if (mistakes.length > 0) {
        const remoteMistakes = mistakes
          .filter(m => isRealUuid(m.game_id))
          .map(m => ({
            ...m,
            id: isRealUuid(m.id) ? m.id : undefined,
            user_id: userId
          }));
        if (remoteMistakes.length > 0) {
          await supabase.from("mistakes").upsert(remoteMistakes);
        }
      }

      if (exercises.length > 0) {
        const remoteExercises = exercises
          .filter(e => isRealUuid(e.game_id || ""))
          .map(e => ({
            ...e,
            id: isRealUuid(e.id) ? e.id : undefined,
            user_id: userId
          }));
        if (remoteExercises.length > 0) {
          await supabase.from("training_exercises").upsert(remoteExercises);
        }
      }

      const remoteSchedules = schedules
        .filter(s => isRealUuid(s.exercise_id))
        .map(s => ({
          ...s,
          user_id: userId
        }));
      if (remoteSchedules.length > 0) {
        await supabase.from("review_schedule").upsert(remoteSchedules);
      }
    } catch (err) {
      console.warn("Supabase training persistence fallback to local storage:", err);
    }
  }

  return { exercises, schedule: schedules };
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
      lapses: currentSched?.lapses ?? 0
    },
    attempt.grade,
    now
  );

  const updatedSched: ReviewScheduleRecord = {
    exercise_id: exercise.id,
    user_id: currentSched?.user_id || userId || "local",
    due_at: sm2Result.dueAt.toISOString(),
    interval_days: sm2Result.intervalDays,
    ease_factor: sm2Result.easeFactor,
    repetitions: sm2Result.repetitions,
    lapses: sm2Result.lapses,
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
    user_id: userId || "local",
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
    try {
      await supabase.from("review_schedule").upsert(updatedSched);
      if (sm2Result.isMastered) {
        await supabase
          .from("training_exercises")
          .update({ status: "mastered" })
          .eq("id", exercise.id);
      }
      await supabase.from("exercise_attempts").insert({
        exercise_id: exercise.id,
        user_id: userId,
        correct: attempt.correct,
        duration_ms: attempt.durationMs,
        hints_used: attempt.hintsUsed,
        moves_tried: attempt.movesTried,
        grade: attempt.grade
      });
    } catch (err) {
      console.warn("Supabase schedule update error:", err);
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
    try {
      await supabase
        .from("training_exercises")
        .update({ status: "flagged", flag_reason: reason })
        .eq("id", exerciseId);
    } catch (err) {
      console.warn("Supabase flag exercise error:", err);
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
