/**
 * Platform Sync — Shared Types
 *
 * Defines the contracts for platform adapters, sync state, and import logs.
 * All adapters must remain pure with respect to storage — they fetch and
 * normalise; a shared importer writes rows and handles deduplication.
 */

import type { GameRecord } from "../games";

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A cursor is an opaque JSON value the adapter understands.
 * For Chess.com it stores the archive month URLs seen + per-URL ETags.
 * For Lichess it stores the ISO timestamp of the last game fetched.
 */
export type SyncCursor = Record<string, unknown>;

/** A single batch of game records returned by the adapter, plus an updated cursor. */
export interface AdapterPage {
  games: NormalisedGame[];
  cursor: SyncCursor;
  /** True when there are no more pages left in the current sync run. */
  done: boolean;
}

/**
 * A game record as returned by the adapter, before fingerprinting and DB write.
 * Adapters must supply at minimum `pgn` and `externalId`.
 */
export interface NormalisedGame {
  pgn: string;
  externalId: string;
  /** e.g. "chesscom" | "lichess" */
  platform: string;
}

/**
 * Platform adapter contract. Implementations for Chess.com and Lichess
 * both follow this interface.
 *
 * Rules:
 * - `listNewGames` MUST respect any rate-limit signals it receives.
 * - Implementations must NEVER open a database connection — they are pure
 *   with respect to storage.
 */
export interface PlatformAdapter {
  readonly platform: "chesscom" | "lichess";
  /**
   * Fetch one "page" of new games starting from `cursor`.
   * Pass an empty `{}` cursor to start from the beginning.
   */
  listNewGames(
    username: string,
    cursor: SyncCursor,
    signal?: AbortSignal
  ): Promise<AdapterPage>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform account (mirrors the DB table)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformAccount {
  id: string;
  user_id: string;
  platform: "chesscom" | "lichess";
  username: string;
  last_synced_at: string | null;
  sync_cursor: SyncCursor;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import log (mirrors the DB table)
// ─────────────────────────────────────────────────────────────────────────────

export type ImportLogStatus = "running" | "completed" | "failed" | "cancelled";

export interface ImportLog {
  id: string;
  user_id: string;
  platform: "chesscom" | "lichess";
  username: string;
  status: ImportLogStatus;
  games_imported: number;
  games_skipped: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync run events (for real-time progress UI)
// ─────────────────────────────────────────────────────────────────────────────

export type SyncEventKind =
  | "started"
  | "page"
  | "rate_limited"
  | "completed"
  | "failed"
  | "cancelled";

export interface SyncEvent {
  kind: SyncEventKind;
  platform: "chesscom" | "lichess";
  username: string;
  gamesImported?: number;
  gamesSkipped?: number;
  retryAfterMs?: number;
  error?: string;
  savedGames?: GameRecord[];
}

export type SyncProgressCallback = (event: SyncEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Sync result (returned from runSync / syncPlatformAccount)
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  platform: "chesscom" | "lichess";
  username: string;
  gamesImported: number;
  gamesSkipped: number;
  status: ImportLogStatus;
  error?: string;
}
