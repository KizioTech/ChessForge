/**
 * Sync Engine
 *
 * Orchestrates a full sync run for a single platform account:
 *   1. Opens an ImportLog entry.
 *   2. Pages through the adapter until `done`.
 *   3. For each page, parses PGN, fingerprints, deduplicates, and writes to the game store.
 *   4. Advances the sync cursor after every successful page (resumable checkpoints).
 *   5. Handles 429 rate-limit errors with an exponential-capped backoff.
 *   6. Finalises the ImportLog on completion, failure, or cancellation.
 *
 * Rules:
 * - Only ONE sync per platform account may be in-flight at a time (enforced by callers via AbortController).
 * - Never writes analysis/positions/exercises — only `games` and `import_logs`.
 * - On abort the last-successfully-saved cursor is preserved so the next run resumes cleanly.
 */

import { parsePgn } from "../pgn-parser";
import { saveParsedGames } from "../games";
import {
  createImportLog,
  finaliseImportLog,
  updateSyncCursor,
} from "./account-service";
import type {
  PlatformAdapter,
  PlatformAccount,
  SyncResult,
  SyncProgressCallback,
} from "./types";
import { RateLimitError as ChesscomRateLimitError } from "./chesscom-adapter";
import { RateLimitError as LichessRateLimitError } from "./lichess-adapter";

/** Minimum and maximum back-off when rate-limited (ms). */
const MIN_BACKOFF_MS = 60_000;   // 60 s
const MAX_BACKOFF_MS = 300_000;  // 5 min

/** How long to pause between pages to be a polite HTTP client (ms). */
const INTER_PAGE_DELAY_MS = 500;

function isRateLimitError(
  err: unknown
): err is ChesscomRateLimitError | LichessRateLimitError {
  return (
    err instanceof ChesscomRateLimitError || err instanceof LichessRateLimitError
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tid = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(tid);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Run a full sync for a single platform account.
 *
 * @param adapter      The platform adapter (Chess.com / Lichess)
 * @param account      The persisted platform_account row
 * @param userId       Authenticated user's ID
 * @param username     The player's platform username (for colour detection)
 * @param onProgress   Optional callback for real-time progress events
 * @param signal       Optional AbortSignal to cancel the run mid-flight
 */
export async function runSync(
  adapter: PlatformAdapter,
  account: PlatformAccount,
  userId: string,
  username: string,
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal
): Promise<SyncResult> {
  const log = await createImportLog(userId, account.platform, account.username);

  let cursor = { ...account.sync_cursor };
  let totalImported = 0;
  let totalSkipped = 0;
  let backoffMs = MIN_BACKOFF_MS;

  onProgress?.({
    kind: "started",
    platform: account.platform,
    username: account.username,
  });

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      let page;
      try {
        page = await adapter.listNewGames(account.username, cursor, signal);
        backoffMs = MIN_BACKOFF_MS; // reset on success
      } catch (err) {
        if (isRateLimitError(err)) {
          const waitMs = Math.min(err.retryAfterMs || MIN_BACKOFF_MS, MAX_BACKOFF_MS);
          onProgress?.({
            kind: "rate_limited",
            platform: account.platform,
            username: account.username,
            retryAfterMs: waitMs,
          });
          await sleep(waitMs, signal);
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          continue; // retry
        }
        throw err;
      }

      if (page.games.length > 0) {
        // Reconstruct a PGN blob for the parser (each game separated by blank line)
        const pgnBlob = page.games.map(g => g.pgn).join("\n\n");

        const { games: parsed } = await parsePgn(pgnBlob, username);

        const saveResult = await saveParsedGames(
          parsed,
          account.platform as "chesscom" | "lichess",
          userId
        );

        const importedThisPage = saveResult.saved.length;
        const skippedThisPage = saveResult.duplicates.length;

        totalImported += importedThisPage;
        totalSkipped += skippedThisPage;

        onProgress?.({
          kind: "page",
          platform: account.platform,
          username: account.username,
          gamesImported: totalImported,
          gamesSkipped: totalSkipped,
          savedGames: saveResult.saved,
        });
      }

      // Persist cursor checkpoint after every page (resumable)
      cursor = page.cursor;
      await updateSyncCursor(account.id, cursor, userId);

      if (page.done) break;

      // Polite delay between pages
      if (page.games.length > 0) {
        await sleep(INTER_PAGE_DELAY_MS, signal);
      }
    }

    await finaliseImportLog(log.id, userId, {
      status: "completed",
      games_imported: totalImported,
      games_skipped: totalSkipped,
    });

    onProgress?.({
      kind: "completed",
      platform: account.platform,
      username: account.username,
      gamesImported: totalImported,
      gamesSkipped: totalSkipped,
    });

    return {
      platform: account.platform,
      username: account.username,
      gamesImported: totalImported,
      gamesSkipped: totalSkipped,
      status: "completed",
    };
  } catch (err: unknown) {
    const isAbort =
      err instanceof DOMException && err.name === "AbortError";
    const status = isAbort ? "cancelled" : "failed";
    const errorMessage = isAbort
      ? "Sync cancelled by user"
      : (err instanceof Error ? err.message : String(err));

    await finaliseImportLog(log.id, userId, {
      status,
      games_imported: totalImported,
      games_skipped: totalSkipped,
      error_message: errorMessage,
    });

    onProgress?.({
      kind: isAbort ? "cancelled" : "failed",
      platform: account.platform,
      username: account.username,
      gamesImported: totalImported,
      gamesSkipped: totalSkipped,
      error: errorMessage,
    });

    return {
      platform: account.platform,
      username: account.username,
      gamesImported: totalImported,
      gamesSkipped: totalSkipped,
      status,
      error: errorMessage,
    };
  }
}
