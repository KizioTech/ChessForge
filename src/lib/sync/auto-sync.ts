/**
 * Auto-Sync Service
 *
 * Runs a background sync for all connected platform accounts:
 *   - On app startup (once per calendar day, gated by localStorage timestamp).
 *   - On demand when the user clicks "Sync Games".
 *
 * Rules:
 * - Only one sync run may be in-flight globally at a time.
 * - Only writes `games` and `import_logs` — never analyses, exercises, or positions.
 * - Rate limits are handled by the underlying sync engine (min 60 s backoff).
 * - The daily gate uses the UTC date string so a midnight rollover triggers a new run.
 */

import { getPlatformAccounts, upsertPlatformAccount } from "./account-service";
import { runSync } from "./sync-engine";
import { ChesscomAdapter } from "./chesscom-adapter";
import { LichessAdapter } from "./lichess-adapter";
import type { GameRecord } from "../games";
import type { SyncResult } from "./types";

const LS_LAST_AUTO_SYNC_KEY = "chessforge:last_auto_sync_date";
const LS_PROFILE_RATINGS_KEY = "chessforge_custom_profile_ratings";

export interface AutoSyncOptions {
  userId: string;
  /** Player's display username used for colour detection during PGN parsing. */
  username?: string;
  /** Called with every game saved during the run so the UI can refresh. */
  onGamesImported?: (games: GameRecord[]) => void;
  /** Called when the full run completes with aggregated results. */
  onComplete?: (results: SyncResult[]) => void;
  /** If provided, the run is cancellable. */
  signal?: AbortSignal;
}

/** True while an auto-sync is in progress (module-level guard). */
let _running = false;

/**
 * Returns the UTC date string (e.g. "2026-11-12") for the daily gate check.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns true if an auto-sync has NOT yet run today.
 */
export function isAutoSyncDue(): boolean {
  try {
    const last = localStorage.getItem(LS_LAST_AUTO_SYNC_KEY);
    return last !== todayUtc();
  } catch {
    return true;
  }
}

/**
 * Record that an auto-sync ran today (suppress further daily runs until tomorrow).
 */
function markSyncRanToday(): void {
  try {
    localStorage.setItem(LS_LAST_AUTO_SYNC_KEY, todayUtc());
  } catch {
    /* ignore */
  }
}

/**
 * Run a sync for all connected platform accounts.
 *
 * Safe to call multiple times — if a run is already in progress the new call
 * returns an empty array immediately.
 *
 * @param opts          Options (see AutoSyncOptions).
 * @param dailyGated    When true, skips if already synced today (startup path).
 *                      When false (manual button), always runs.
 */
export async function runAutoSync(
  opts: AutoSyncOptions,
  dailyGated = false
): Promise<SyncResult[]> {
  if (_running) {
    console.info("[AutoSync] Already running — skipping.");
    return [];
  }

  if (dailyGated && !isAutoSyncDue()) {
    console.info("[AutoSync] Already synced today — skipping.");
    return [];
  }

  let accounts = await getPlatformAccounts(opts.userId);

  // If no accounts found in platform_accounts table, attempt to seed from
  // profile editor ratings stored in localStorage (migration path).
  if (accounts.length === 0) {
    try {
      const raw = localStorage.getItem(LS_PROFILE_RATINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.chesscomUsername?.trim()) {
          await upsertPlatformAccount(
            {
              user_id: opts.userId,
              platform: "chesscom",
              username: parsed.chesscomUsername.trim(),
              last_synced_at: null,
              sync_cursor: {},
            },
            opts.userId
          );
        }
        if (parsed.lichessUsername?.trim()) {
          await upsertPlatformAccount(
            {
              user_id: opts.userId,
              platform: "lichess",
              username: parsed.lichessUsername.trim(),
              last_synced_at: null,
              sync_cursor: {},
            },
            opts.userId
          );
        }
        accounts = await getPlatformAccounts(opts.userId);
      }
    } catch {
      /* ignore */
    }
  }

  if (accounts.length === 0) {
    // No accounts connected — still mark today so we don't retry on every render.
    if (dailyGated) markSyncRanToday();
    return [];
  }

  _running = true;
  const results: SyncResult[] = [];

  try {
    for (const account of accounts) {
      if (opts.signal?.aborted) break;

      const adapter =
        account.platform === "chesscom"
          ? new ChesscomAdapter()
          : new LichessAdapter();

      try {
        const result = await runSync(
          adapter,
          account,
          opts.userId,
          opts.username || account.username,
          (evt) => {
            // Bubble newly saved games up to the UI immediately.
            if (evt.kind === "page" && evt.savedGames?.length) {
              opts.onGamesImported?.(evt.savedGames);
            }
          },
          opts.signal
        );
        results.push(result);
      } catch (err) {
        // One account failing should not block the remaining accounts.
        console.error(
          `[AutoSync] Failed for ${account.platform}/${account.username}:`,
          err
        );
        results.push({
          platform: account.platform,
          username: account.username,
          gamesImported: 0,
          gamesSkipped: 0,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (dailyGated) markSyncRanToday();
    opts.onComplete?.(results);
    return results;
  } finally {
    _running = false;
  }
}

/** Cancel any in-flight auto-sync (best-effort — relies on AbortSignal support). */
export function isAutoSyncRunning(): boolean {
  return _running;
}
