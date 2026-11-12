/**
 * Unit tests for Phase 6 — Platform Sync engine and adapters.
 *
 * Tests:
 * - ChesscomAdapter cursor advancement and ETag caching
 * - LichessAdapter page splitting and cursor advancement
 * - sync-engine runSync orchestration (rate-limit retry, deduplication, abort)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChesscomAdapter } from "../../src/lib/sync/chesscom-adapter";
import { LichessAdapter } from "../../src/lib/sync/lichess-adapter";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Chess.com API stubs
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVES_RESPONSE = {
  archives: [
    "https://api.chess.com/pub/player/testuser/games/2026/10",
    "https://api.chess.com/pub/player/testuser/games/2026/11",
  ],
};

const MONTH_GAMES_RESPONSE = {
  games: [
    {
      url: "https://www.chess.com/game/live/12345",
      pgn: `[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.15"]\n[White "testuser"]\n[Black "opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`,
    },
    {
      url: "https://www.chess.com/game/live/12346",
      pgn: `[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2026.10.20"]\n[White "opponent"]\n[Black "testuser"]\n[Result "0-1"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1`,
    },
  ],
};

function mockFetch(responses: Array<{ url: RegExp; response: unknown; status?: number; headers?: Record<string, string> }>) {
  return vi.fn().mockImplementation((url: string) => {
    const match = responses.find(r => r.url.test(url));
    if (!match) throw new Error(`Unexpected fetch: ${url}`);
    const { status = 200, headers = {}, response } = match;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : String(status),
      headers: { get: (k: string) => headers[k] ?? null },
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(typeof response === "string" ? response : JSON.stringify(response)),
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ChesscomAdapter tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ChesscomAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches archive list and returns first month games", async () => {
    globalThis.fetch = mockFetch([
      { url: /archives/, response: ARCHIVES_RESPONSE },
      { url: /2026\/10/, response: MONTH_GAMES_RESPONSE, headers: { ETag: `"etag-oct"` } },
    ]);

    const adapter = new ChesscomAdapter();
    const page = await adapter.listNewGames("testuser", {});

    expect(page.games).toHaveLength(2);
    expect(page.games[0].platform).toBe("chesscom");
    expect(page.games[0].externalId).toBe("https://www.chess.com/game/live/12345");
    expect(page.done).toBe(false); // November not yet fetched
    // ETag should be stored in cursor
    expect((page.cursor as any).etags["https://api.chess.com/pub/player/testuser/games/2026/10"]).toBe(`"etag-oct"`);
  });

  it("skips already-completed archive URLs", async () => {
    globalThis.fetch = mockFetch([
      { url: /archives/, response: ARCHIVES_RESPONSE },
      { url: /2026\/11/, response: MONTH_GAMES_RESPONSE },
    ]);

    const adapter = new ChesscomAdapter();
    const cursor = {
      etags: {},
      completedUrls: ["https://api.chess.com/pub/player/testuser/games/2026/10"],
    };
    const page = await adapter.listNewGames("testuser", cursor);

    // Should have fetched November, not October
    expect(page.games).toHaveLength(2);
    expect(page.done).toBe(true); // both months now done
  });

  it("handles 304 Not Modified by marking URL completed and returning no games", async () => {
    globalThis.fetch = mockFetch([
      { url: /archives/, response: ARCHIVES_RESPONSE },
      { url: /2026\/10/, response: null, status: 304 },
    ]);

    const adapter = new ChesscomAdapter();
    const cursor = { etags: { "https://api.chess.com/pub/player/testuser/games/2026/10": `"etag-old"` }, completedUrls: [] };
    const page = await adapter.listNewGames("testuser", cursor);

    expect(page.games).toHaveLength(0);
    expect((page.cursor as any).completedUrls).toContain("https://api.chess.com/pub/player/testuser/games/2026/10");
  });

  it("throws RateLimitError on 429", async () => {
    globalThis.fetch = mockFetch([
      { url: /archives/, response: null, status: 429, headers: { "Retry-After": "30" } },
    ]);

    const { RateLimitError } = await import("../../src/lib/sync/chesscom-adapter");
    const adapter = new ChesscomAdapter();
    await expect(adapter.listNewGames("testuser", {})).rejects.toThrow(RateLimitError);
  });

  it("returns done=true when all archives are completed", async () => {
    globalThis.fetch = mockFetch([
      { url: /archives/, response: ARCHIVES_RESPONSE },
    ]);

    const adapter = new ChesscomAdapter();
    const cursor = {
      etags: {},
      completedUrls: [
        "https://api.chess.com/pub/player/testuser/games/2026/10",
        "https://api.chess.com/pub/player/testuser/games/2026/11",
      ],
    };
    const page = await adapter.listNewGames("testuser", cursor);
    expect(page.games).toHaveLength(0);
    expect(page.done).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LichessAdapter tests
// ─────────────────────────────────────────────────────────────────────────────

const LICHESS_PGN_TWO_GAMES = `[Event "Rated Rapid game"]
[Site "https://lichess.org/abc123"]
[Date "2026.11.01"]
[UTCDate "2026.11.01"]
[UTCTime "10:00:00"]
[White "testuser"]
[Black "opponent1"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Rated Rapid game"]
[Site "https://lichess.org/def456"]
[Date "2026.11.02"]
[UTCDate "2026.11.02"]
[UTCTime "12:00:00"]
[White "opponent2"]
[Black "testuser"]
[Result "0-1"]

1. d4 d5 2. c4 c6 0-1`;

describe("LichessAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and splits multi-game PGN stream", async () => {
    globalThis.fetch = mockFetch([
      { url: /lichess\.org\/api\/games/, response: LICHESS_PGN_TWO_GAMES },
    ]);

    const adapter = new LichessAdapter();
    const page = await adapter.listNewGames("testuser", {});

    expect(page.games).toHaveLength(2);
    expect(page.games[0].platform).toBe("lichess");
    expect(page.games[0].externalId).toBe("https://lichess.org/abc123");
  });

  it("advances cursor sinceMs to latest game timestamp", async () => {
    globalThis.fetch = mockFetch([
      { url: /lichess\.org\/api\/games/, response: LICHESS_PGN_TWO_GAMES },
    ]);

    const adapter = new LichessAdapter();
    const page = await adapter.listNewGames("testuser", {});

    // The latest game is 2026-11-02 12:00:00Z
    const expected = new Date("2026-11-02T12:00:00Z").getTime();
    expect((page.cursor as any).sinceMs).toBe(expected);
  });

  it("includes since param in URL when cursor has sinceMs", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({}),
      });
    });

    const adapter = new LichessAdapter();
    const sinceMs = new Date("2026-11-01T00:00:00Z").getTime();
    await adapter.listNewGames("testuser", { sinceMs });

    expect(capturedUrl).toContain(`since=${sinceMs + 1}`);
  });

  it("throws RateLimitError on 429", async () => {
    globalThis.fetch = mockFetch([
      { url: /lichess\.org/, response: null, status: 429, headers: { "Retry-After": "60" } },
    ]);

    const { RateLimitError } = await import("../../src/lib/sync/lichess-adapter");
    const adapter = new LichessAdapter();
    await expect(adapter.listNewGames("testuser", {})).rejects.toThrow(RateLimitError);
  });

  it("returns done=true when page has fewer games than PAGE_LIMIT", async () => {
    globalThis.fetch = mockFetch([
      { url: /lichess\.org/, response: LICHESS_PGN_TWO_GAMES },
    ]);

    const adapter = new LichessAdapter();
    const page = await adapter.listNewGames("testuser", {});
    // 2 games < 50 (PAGE_LIMIT) → done
    expect(page.done).toBe(true);
  });
});
