/**
 * Lichess Platform Adapter
 *
 * Implements PlatformAdapter for the Lichess export API.
 *
 * API behaviour:
 * - GET https://lichess.org/api/games/user/{username}
 *   Returns a stream of PGN games, newest first.
 *   Supports `since` and `until` query params (Unix ms timestamps).
 *   Optional params: clocks=true, opening=true, evals=true (embedded Stockfish evals).
 *
 * Rate limit rules (Lichess terms):
 * - Only ONE request at a time per user (the adapter is called sequentially by the sync engine).
 * - After a 429, wait at least 60 seconds before retrying.
 * - Use Personal API tokens only when needed; for public games of public accounts, no auth is required.
 *
 * Cursor schema:
 * {
 *   sinceMs: number | null,  // Unix ms of the last imported game's creation date
 * }
 */

import type { PlatformAdapter, AdapterPage, SyncCursor } from "./types";

const LICHESS_API = "https://lichess.org/api";
const USER_AGENT = "ChessForge/0.6.0 (personal-training; github.com/KizioTech/ChessForge)";
const DEFAULT_TIMEOUT_MS = 30_000; // Lichess streams can be slow
/** Max games per page — keeps memory bounded. */
const PAGE_LIMIT = 50;

interface LichessCursor {
  /** Unix ms timestamp; fetch games created after this point. */
  sinceMs: number | null;
}

function parseCursor(raw: SyncCursor): LichessCursor {
  return {
    sinceMs: typeof raw.sinceMs === "number" ? raw.sinceMs : null,
  };
}

/** Raise a RateLimitError when Lichess responds 429. */
export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs = 60_000) {
    super(`Lichess rate limited. Retry after ${retryAfterMs}ms.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Split a Lichess multi-game PGN stream (ndjson or plain PGN) into
 * individual game PGN strings.
 */
function splitLichessPgn(raw: string): string[] {
  if (!raw.trim()) return [];
  const games: string[] = [];
  const blocks = raw.split(/\n\n(?=\[Event)/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed) games.push(trimmed);
  }
  return games;
}

/**
 * Extract the Date/UTCDate header + a game URL from a PGN string to
 * derive a creation timestamp for cursor advancement.
 */
function extractGameTimestampMs(pgn: string): number | null {
  // Lichess embeds [UTCDate "YYYY.MM.DD"] and [UTCTime "HH:MM:SS"]
  const dateMatch = pgn.match(/\[UTCDate\s+"(\d{4}\.\d{2}\.\d{2})"\]/);
  const timeMatch = pgn.match(/\[UTCTime\s+"(\d{2}:\d{2}:\d{2})"\]/);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1].replace(/\./g, "-");
  const timeStr = timeMatch ? timeMatch[1] : "00:00:00";
  try {
    const d = new Date(`${dateStr}T${timeStr}Z`);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

/** Extract the game URL for use as external_id. */
function extractGameUrl(pgn: string): string {
  const m = pgn.match(/\[Site\s+"(https?:\/\/lichess\.org\/[^"]+)"\]/);
  return m ? m[1] : "";
}

export class LichessAdapter implements PlatformAdapter {
  readonly platform = "lichess" as const;

  async listNewGames(
    username: string,
    cursor: SyncCursor,
    signal?: AbortSignal
  ): Promise<AdapterPage> {
    const cur = parseCursor(cursor);

    const params = new URLSearchParams({
      max: String(PAGE_LIMIT),
      clocks: "true",
      opening: "true",
      evals: "true",
      sort: "dateAsc",
    });

    if (cur.sinceMs !== null) {
      // Add 1 ms to avoid re-fetching the last seen game
      params.set("since", String(cur.sinceMs + 1));
    }

    const url = `${LICHESS_API}/games/user/${encodeURIComponent(username)}?${params}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
    // Merge with caller-supplied signal
    if (signal) {
      signal.addEventListener("abort", () => ctrl.abort());
    }

    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/x-chess-pgn",
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(tid);
    }

    if (resp.status === 429) {
      const retryAfter = Number(resp.headers.get("Retry-After") ?? 60) * 1000;
      throw new RateLimitError(retryAfter);
    }

    if (!resp.ok) {
      throw new Error(`Lichess API error: ${resp.status} ${resp.statusText}`);
    }

    const body = await resp.text();
    const pgns = splitLichessPgn(body);

    if (pgns.length === 0) {
      return { games: [], cursor: { sinceMs: cur.sinceMs }, done: true };
    }

    // Advance cursor to the timestamp of the most-recent game in this page
    let latestMs = cur.sinceMs;
    for (const pgn of pgns) {
      const ts = extractGameTimestampMs(pgn);
      if (ts !== null && (latestMs === null || ts > latestMs)) {
        latestMs = ts;
      }
    }

    const normalisedGames = pgns.map(pgn => ({
      pgn,
      externalId: extractGameUrl(pgn),
      platform: "lichess" as const,
    }));

    // If we got a full page, there might be more games
    const done = pgns.length < PAGE_LIMIT;

    return {
      games: normalisedGames,
      cursor: { sinceMs: latestMs },
      done,
    };
  }
}
