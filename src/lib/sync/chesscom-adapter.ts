/**
 * Chess.com Platform Adapter
 *
 * Implements PlatformAdapter for Chess.com's public PubAPI.
 *
 * API behaviour:
 * - GET https://api.chess.com/pub/player/{username}/games/archives
 *   Returns a list of monthly archive URLs.
 * - GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
 *   Returns all games for a given month. Supports If-None-Match + ETag caching.
 *
 * Rate limit rules (Chess.com terms):
 * - Send a descriptive User-Agent with contact information.
 * - Use conditional requests (If-None-Match / ETag) to skip unchanged months.
 * - Back off when a 429 is received; the adapter surfaces retryAfterMs.
 *
 * Cursor schema:
 * {
 *   archiveUrlsCursor: string | null,  // last archive URL fully fetched
 *   etags: Record<string, string>,     // url -> ETag
 *   completedUrls: string[],           // archive URLs already imported
 * }
 */

import type { PlatformAdapter, AdapterPage, SyncCursor } from "./types";

const CHESSCOM_API = "https://api.chess.com/pub";
const USER_AGENT = "ChessForge/0.6.0 (personal-training; github.com/KizioTech/ChessForge)";
const DEFAULT_TIMEOUT_MS = 15_000;

interface ChesscomCursor {
  etags: Record<string, string>;       // archiveUrl -> ETag
  completedUrls: string[];             // archive URLs fully imported
}

function parseCursor(raw: SyncCursor): ChesscomCursor {
  return {
    etags: (raw.etags as Record<string, string>) ?? {},
    completedUrls: (raw.completedUrls as string[]) ?? [],
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

/** Raise a RateLimitError when the server responds 429. */
export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs = 60_000) {
    super(`Chess.com rate limited. Retry after ${retryAfterMs}ms.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ChesscomAdapter implements PlatformAdapter {
  readonly platform = "chesscom" as const;

  async listNewGames(
    username: string,
    cursor: SyncCursor,
    signal?: AbortSignal
  ): Promise<AdapterPage> {
    const cur = parseCursor(cursor);
    const completedSet = new Set(cur.completedUrls);

    // 1. Fetch archive index
    const archiveUrl = `${CHESSCOM_API}/player/${encodeURIComponent(username)}/games/archives`;
    const archiveResp = await fetchWithTimeout(archiveUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal,
    });

    if (archiveResp.status === 429) {
      const retryAfter = Number(archiveResp.headers.get("Retry-After") ?? 60) * 1000;
      throw new RateLimitError(retryAfter);
    }
    if (!archiveResp.ok) {
      throw new Error(`Chess.com archives fetch failed: ${archiveResp.status} ${archiveResp.statusText}`);
    }

    const { archives } = (await archiveResp.json()) as { archives: string[] };

    // Find the first archive URL not yet completed (oldest first → newest last)
    const pending = archives.filter(u => !completedSet.has(u));
    if (pending.length === 0) {
      return { games: [], cursor: { etags: cur.etags, completedUrls: cur.completedUrls }, done: true };
    }

    // Process ONE archive URL per call (keeps page sizes manageable)
    const monthUrl = pending[0];
    const headers: HeadersInit = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    };
    if (cur.etags[monthUrl]) {
      headers["If-None-Match"] = cur.etags[monthUrl];
    }

    const monthResp = await fetchWithTimeout(monthUrl, { headers, signal });

    if (monthResp.status === 429) {
      const retryAfter = Number(monthResp.headers.get("Retry-After") ?? 60) * 1000;
      throw new RateLimitError(retryAfter);
    }

    // 304 Not Modified — month unchanged, mark as completed and move on
    if (monthResp.status === 304) {
      const newCompletedUrls = [...cur.completedUrls, monthUrl];
      return {
        games: [],
        cursor: { etags: cur.etags, completedUrls: newCompletedUrls },
        done: newCompletedUrls.length === archives.length,
      };
    }

    if (!monthResp.ok) {
      throw new Error(`Chess.com month fetch failed: ${monthResp.status} ${monthResp.statusText}`);
    }

    // Store ETag for next run
    const newEtags = { ...cur.etags };
    const etag = monthResp.headers.get("ETag");
    if (etag) newEtags[monthUrl] = etag;

    const { games: rawGames } = (await monthResp.json()) as { games: Array<{ pgn?: string; url?: string }> };

    const normalisedGames = rawGames
      .filter(g => g.pgn)
      .map(g => ({
        pgn: g.pgn!,
        externalId: g.url ?? monthUrl,
        platform: "chesscom" as const,
      }));

    const newCompletedUrls = [...cur.completedUrls, monthUrl];
    return {
      games: normalisedGames,
      cursor: { etags: newEtags, completedUrls: newCompletedUrls },
      done: newCompletedUrls.length === archives.length,
    };
  }
}
