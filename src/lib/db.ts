/**
 * db.ts — Dexie (IndexedDB) database schema for ChessForge.
 *
 * Replaces localStorage for all training, game, and sync data.
 * Provides quota-safe, structured, queryable offline storage.
 *
 * Version history:
 *   1 — Initial schema: games, exercises, review_schedule, exercise_attempts,
 *       mistakes, outbox
 */

import Dexie, { type Table } from "dexie";
import type { GameRecord } from "./games";
import type {
  TrainingExerciseRecord,
  ReviewScheduleRecord,
  ExerciseAttemptRecord,
  MistakeRecord
} from "./training/types";

// ── Outbox record (offline write queue) ──────────────────────────────────────

export type OutboxOperation = "upsert" | "delete";

export interface OutboxRecord {
  /** Auto-incremented primary key */
  id?: number;
  /** Target Supabase table */
  table: string;
  /** Operation to perform */
  operation: OutboxOperation;
  /** User who owns this write */
  userId: string;
  /** Row payload (for upsert) */
  payload: Record<string, unknown>;
  /** Identifier for delete operations */
  rowId?: string;
  /** ISO timestamp when this entry was queued */
  queuedAt: string;
  /** Number of failed flush attempts */
  attempts: number;
  /** ISO timestamp of last failure */
  lastFailedAt?: string;
}

// ── Database class ────────────────────────────────────────────────────────────

export class ChessForgeDb extends Dexie {
  games!: Table<GameRecord, string>;
  exercises!: Table<TrainingExerciseRecord, string>;
  review_schedule!: Table<ReviewScheduleRecord, string>;
  exercise_attempts!: Table<ExerciseAttemptRecord, number>;
  mistakes!: Table<MistakeRecord, string>;
  outbox!: Table<OutboxRecord, number>;

  constructor() {
    super("ChessForgeDb");

    this.version(1).stores({
      // games: id (PK), user_id, fingerprint (unique per user), played_at index
      games: "id, user_id, fingerprint, played_at, platform, source",

      // exercises: id (PK), user_id, game_id, status, updated_at
      exercises: "id, user_id, game_id, status, updated_at",

      // review_schedule: exercise_id (PK), user_id, due_at
      review_schedule: "exercise_id, user_id, due_at, last_reviewed_at",

      // exercise_attempts: auto-inc id, exercise_id+attempted_at for dedup
      exercise_attempts: "++id, exercise_id, user_id, attempted_at, [exercise_id+attempted_at]",

      // mistakes: id (PK), user_id, game_id, source, ply
      mistakes: "id, user_id, game_id, source, ply, engine_class",

      // outbox: auto-inc id, table, userId, queuedAt for ordering
      outbox: "++id, table, userId, queuedAt, attempts"
    });
  }
}

export function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Singleton database instance (lazy-initialised). */
let _db: ChessForgeDb | null = null;

export function getDb(): ChessForgeDb {
  if (!_db) {
    _db = new ChessForgeDb();
  }
  return _db;
}

/** For testing: replace the singleton with a mock / in-memory instance. */
export function _setDbForTest(db: ChessForgeDb | null): void {
  _db = db;
}
