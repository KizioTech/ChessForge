/**
 * repository.ts — IndexedDB-backed repository layer for ChessForge.
 *
 * Provides typed CRUD helpers over the Dexie tables defined in db.ts.
 * On first access, automatically migrates any existing localStorage data
 * into IndexedDB so existing users don't lose their local data.
 *
 * Rules (Item 12 — pure-core / data-layer boundary):
 *   - This module is the ONLY place that reads/writes IndexedDB for game,
 *     training, and mistake data.
 *   - Callers (training-service.ts, games.ts) import from here, NOT from
 *     Dexie directly.
 *   - Engine, insight, and opening modules must NOT import from repository.ts
 *     (they are pure computation, never storage).
 */

import { getDb, isIndexedDbSupported } from "./db";
import type { GameRecord } from "./games";
import type {
  TrainingExerciseRecord,
  ReviewScheduleRecord,
  ExerciseAttemptRecord,
  MistakeRecord
} from "./training/types";

// ── Migration guard ───────────────────────────────────────────────────────────

const LS_MIGRATED_KEY = "chessforge:idb_migrated_v1";

function alreadyMigrated(): boolean {
  try {
    return localStorage.getItem(LS_MIGRATED_KEY) === "1";
  } catch {
    return false;
  }
}

function markMigrated(): void {
  try {
    localStorage.setItem(LS_MIGRATED_KEY, "1");
  } catch {}
}

function readLocalJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * One-time migration: copy localStorage training data into IndexedDB.
 * Called lazily on the first repository access, then never again.
 */
async function migrateFromLocalStorage(): Promise<void> {
  if (alreadyMigrated()) return;

  const db = getDb();

  try {
    const exercises = readLocalJson<TrainingExerciseRecord>("chessforge:exercises");
    if (exercises.length > 0) await db.exercises.bulkPut(exercises).catch(() => {});

    const schedule = readLocalJson<ReviewScheduleRecord>("chessforge:schedule");
    if (schedule.length > 0) await db.review_schedule.bulkPut(schedule).catch(() => {});

    const attempts = readLocalJson<ExerciseAttemptRecord>("chessforge:attempts");
    if (attempts.length > 0) await db.exercise_attempts.bulkPut(attempts).catch(() => {});

    const mistakes = readLocalJson<MistakeRecord>("chessforge:mistakes");
    if (mistakes.length > 0) await db.mistakes.bulkPut(mistakes).catch(() => {});

    const games = readLocalJson<GameRecord>("chessforge_local_games_v1");
    if (games.length > 0) await db.games.bulkPut(games).catch(() => {});

    markMigrated();
    console.info(`[Repository] localStorage migration complete.`);
  } catch (err) {
    console.warn("[Repository] Migration failed (non-fatal):", err);
  }
}

let _migrationPromise: Promise<void> | null = null;

async function ensureMigrated(): Promise<void> {
  if (!isIndexedDbSupported()) return;
  if (!_migrationPromise) {
    _migrationPromise = migrateFromLocalStorage();
  }
  return _migrationPromise;
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function dbGetGames(userId?: string | null): Promise<GameRecord[]> {
  if (!isIndexedDbSupported()) return [];
  await ensureMigrated();
  const db = getDb();
  if (userId) {
    return db.games.where("user_id").equals(userId).reverse().sortBy("played_at");
  }
  return db.games.toArray();
}

export async function dbPutGames(games: GameRecord[]): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.games.bulkPut(games);
}

export async function dbDeleteGame(gameId: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.games.delete(gameId);
}

export async function dbGetGameFingerprints(userId?: string | null): Promise<Set<string>> {
  if (!isIndexedDbSupported()) return new Set();
  await ensureMigrated();
  const db = getDb();
  const games = userId
    ? await db.games.where("user_id").equals(userId).toArray()
    : await db.games.toArray();
  return new Set(games.map(g => g.fingerprint));
}

// ── Training Exercises ────────────────────────────────────────────────────────

export async function dbGetExercises(userId?: string): Promise<TrainingExerciseRecord[]> {
  if (!isIndexedDbSupported()) return [];
  await ensureMigrated();
  const db = getDb();
  if (userId) {
    return db.exercises.where("user_id").equals(userId).toArray();
  }
  return db.exercises.toArray();
}

export async function dbPutExercises(exercises: TrainingExerciseRecord[]): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.exercises.bulkPut(exercises);
}

export async function dbUpdateExercise(
  id: string,
  changes: Partial<TrainingExerciseRecord>
): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.exercises.update(id, changes);
}

// ── Review Schedule ───────────────────────────────────────────────────────────

export async function dbGetSchedules(userId?: string): Promise<ReviewScheduleRecord[]> {
  if (!isIndexedDbSupported()) return [];
  await ensureMigrated();
  const db = getDb();
  if (userId) {
    return db.review_schedule.where("user_id").equals(userId).toArray();
  }
  return db.review_schedule.toArray();
}

export async function dbPutSchedule(schedule: ReviewScheduleRecord): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.review_schedule.put(schedule);
}

export async function dbPutSchedules(schedules: ReviewScheduleRecord[]): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.review_schedule.bulkPut(schedules);
}

// ── Exercise Attempts ─────────────────────────────────────────────────────────

export async function dbGetAttempts(userId?: string): Promise<ExerciseAttemptRecord[]> {
  if (!isIndexedDbSupported()) return [];
  await ensureMigrated();
  const db = getDb();
  if (userId) {
    return db.exercise_attempts.where("user_id").equals(userId).toArray();
  }
  return db.exercise_attempts.toArray();
}

export async function dbAddAttempt(attempt: ExerciseAttemptRecord): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.exercise_attempts.add(attempt);
}

export async function dbBulkAddAttempts(attempts: ExerciseAttemptRecord[]): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.exercise_attempts.bulkAdd(attempts).catch(() => {}); // ignore duplicate constraint errors
}

// ── Mistakes ──────────────────────────────────────────────────────────────────

export async function dbGetMistakes(userId?: string): Promise<MistakeRecord[]> {
  if (!isIndexedDbSupported()) return [];
  await ensureMigrated();
  const db = getDb();
  if (userId) {
    return db.mistakes.where("user_id").equals(userId).toArray();
  }
  return db.mistakes.toArray();
}

export async function dbPutMistakes(mistakes: MistakeRecord[]): Promise<void> {
  if (!isIndexedDbSupported()) return;
  await ensureMigrated();
  const db = getDb();
  await db.mistakes.bulkPut(mistakes);
}
