/**
 * lichess-puzzles.ts — Lichess Open Puzzle Integration
 *
 * CC0-licensed puzzle database via Lichess public API.
 * - GET https://lichess.org/api/puzzle/daily  → single daily puzzle (no auth)
 * - GET https://lichess.org/api/puzzle/batch/next?nb=30&themes=fork,pin,endgame  → batch
 *
 * Provides open-source puzzle training and caching for ChessForge.
 */

import { Chess, type Square } from "chess.js";

const LS_KEY = "chessforge:lichess-puzzles";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface LichessPuzzle {
  id: string;
  rating: number;
  themes: string[];
  /** FEN of position BEFORE first move in solution */
  initialFen: string;
  /** Solution in UCI: solution[0] is the puzzle-setter's first move (you must play solution[1]) */
  solution: string[];
  /** Game PGN for context (may be empty string) */
  pgn: string;
}

interface PuzzleCache {
  puzzles: LichessPuzzle[];
  fetchedAt: number;
}

export function loadCachedPuzzles(): LichessPuzzle[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const cache: PuzzleCache = JSON.parse(raw);
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return [];
    return cache.puzzles;
  } catch {
    return [];
  }
}

export function savePuzzleCache(puzzles: LichessPuzzle[]): void {
  try {
    const cache: PuzzleCache = { puzzles, fetchedAt: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore local storage errors
  }
}

/**
 * Replay a PGN string up to the given ply index (0-based half-moves)
 * and return the resulting FEN.
 */
export function extractFenAtPly(pgn: string, ply: number): string | null {
  try {
    if (!pgn || pgn.trim().length === 0) {
      return new Chess().fen();
    }
    const chess = new Chess();
    // Load full PGN
    chess.loadPgn(pgn, { strict: false });
    const history = chess.history({ verbose: true });
    
    // Reset and replay up to ply
    const start = new Chess();
    for (let i = 0; i < ply && i < history.length; i++) {
      start.move(history[i].san);
    }
    return start.fen();
  } catch {
    return null;
  }
}

/** Fetch the daily puzzle (always available, no auth needed). */
export async function fetchDailyPuzzle(): Promise<LichessPuzzle | null> {
  try {
    const res = await fetch("https://lichess.org/api/puzzle/daily", {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.puzzle;
    const g = data.game;
    if (!p) return null;
    const fen = extractFenAtPly(g?.pgn ?? "", p?.initialPly ?? 0);
    if (!fen) return null;
    return {
      id: p.id,
      rating: p.rating,
      themes: p.themes ?? [],
      initialFen: fen,
      solution: p.solution ?? [],
      pgn: g?.pgn ?? ""
    };
  } catch {
    return null;
  }
}

/** Fetch a batch of puzzles by themes. Falls back gracefully to daily or empty. */
export async function fetchPuzzleBatch(nb = 20, themes: string[] = []): Promise<LichessPuzzle[]> {
  try {
    const params = new URLSearchParams({ nb: String(nb) });
    if (themes.length) params.set("themes", themes.join(","));
    const res = await fetch(`https://lichess.org/api/puzzle/batch/next?${params}`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rawPuzzles: Array<{
      puzzle: { id: string; rating: number; themes: string[]; solution: string[]; initialPly: number };
      game: { pgn: string };
    }> = data.puzzles ?? [];
    
    const result: LichessPuzzle[] = [];
    for (const item of rawPuzzles) {
      const fen = extractFenAtPly(item.game?.pgn ?? "", item.puzzle?.initialPly ?? 0);
      if (!fen) continue;
      result.push({
        id: item.puzzle.id,
        rating: item.puzzle.rating,
        themes: item.puzzle.themes ?? [],
        initialFen: fen,
        solution: item.puzzle.solution ?? [],
        pgn: item.game?.pgn ?? ""
      });
    }
    return result;
  } catch {
    return [];
  }
}

/** Built-in curated offline fallback puzzles if network is down */
export const FALLBACK_PUZZLES: LichessPuzzle[] = [
  {
    id: "offline-1",
    rating: 1350,
    themes: ["endgame", "mate", "mateIn1"],
    initialFen: "6k1/5ppp/8/8/8/8/5PPP/1r4K1 w - - 0 1",
    solution: ["b1b8"],
    pgn: ""
  },
  {
    id: "offline-2",
    rating: 1420,
    themes: ["fork", "middlegame", "advantage"],
    initialFen: "r1bqk2r/pppp1ppp/2n5/4p3/1b2n3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    solution: ["c1d2", "b4c3", "b2c3"],
    pgn: ""
  },
  {
    id: "offline-3",
    rating: 1550,
    themes: ["skewer", "endgame", "rookEndgame"],
    initialFen: "8/8/8/8/4k3/8/1r6/R3K3 b - - 0 1",
    solution: ["e4d3", "a1a3", "d3c2"],
    pgn: ""
  }
];

/** Load puzzles from cache; if empty/stale, fetch a new batch. */
export async function getOrFetchPuzzles(themes: string[] = []): Promise<LichessPuzzle[]> {
  const cached = loadCachedPuzzles();
  if (cached.length > 0) return cached;

  // Try batch first; fall back to daily
  const batch = await fetchPuzzleBatch(20, themes);
  if (batch.length > 0) {
    savePuzzleCache(batch);
    return batch;
  }

  // Fallback: daily puzzle
  const daily = await fetchDailyPuzzle();
  if (daily) {
    savePuzzleCache([daily]);
    return [daily];
  }

  // Offline fallback
  return FALLBACK_PUZZLES;
}

/** Convert a UCI move string (e.g. 'e2e4' or 'e7e8q') into SAN given the current board state */
export function uciToSan(chess: Chess, uci: string): string | null {
  try {
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
    const result = chess.move({ from, to, promotion });
    if (!result) return null;
    return result.san;
  } catch {
    return null;
  }
}
