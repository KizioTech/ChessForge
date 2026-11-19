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
import { CURATED_PUZZLES } from "./curated-puzzles";

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
export function extractFenAtPly(pgn: string, ply?: number): string | null {
  try {
    const c = new Chess();
    if (!pgn || !pgn.trim()) return c.fen();

    // Clean comments, NAGs, variations, headers
    const cleaned = pgn
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\$[0-9]+/g, " ")
      .trim();

    // First attempt: standard loadPgn
    try {
      c.loadPgn(cleaned, { strict: false });
      const history = c.history({ verbose: true });
      if (history.length > 0) {
        const limit = (ply !== undefined && ply > 0) ? Math.min(ply, history.length) : history.length;
        const replay = new Chess();
        for (let i = 0; i < limit; i++) {
          replay.move(history[i].san);
        }
        return replay.fen();
      }
    } catch {
      // Fallback to manual token parsing
    }

    // Fallback: parse tokens manually
    const tokens = cleaned.split(/\s+/);
    const moves: string[] = [];
    for (const t of tokens) {
      if (!t || t.includes(".") || t === "*" || t === "1-0" || t === "0-1" || t === "1/2-1/2") continue;
      moves.push(t);
    }

    const replay = new Chess();
    const limit = (ply !== undefined && ply > 0) ? Math.min(ply, moves.length) : moves.length;
    for (let i = 0; i < limit; i++) {
      const res = replay.move(moves[i]);
      if (!res) break;
    }
    return replay.fen();
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
    // Prefer p.fen if provided directly by Lichess, otherwise replay PGN
    let fen = p.fen;
    if (!fen || fen.trim().length === 0) {
      fen = extractFenAtPly(g?.pgn ?? "", p?.initialPly);
    }
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
      puzzle: { id: string; rating: number; themes: string[]; solution: string[]; initialPly?: number; fen?: string };
      game: { pgn: string };
    }> = data.puzzles ?? [];
    
    const result: LichessPuzzle[] = [];
    for (const item of rawPuzzles) {
      let fen: string | null = item.puzzle.fen ?? null;
      if (!fen || fen.trim().length === 0) {
        fen = extractFenAtPly(item.game?.pgn ?? "", item.puzzle?.initialPly);
      }
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
export const FALLBACK_PUZZLES: LichessPuzzle[] = CURATED_PUZZLES;

/** Known historical Lichess puzzle IDs to seed the archive */
export const ARCHIVED_LICHESS_IDS = ["f9Xve", "00008", "0009B", "000aY"];

/** Fetch a single Lichess puzzle by ID */
export async function fetchPuzzleById(id: string): Promise<LichessPuzzle | null> {
  try {
    const res = await fetch(`https://lichess.org/api/puzzle/${id}`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.puzzle;
    const g = data.game;
    if (!p) return null;
    let fen: string | null = p.fen ?? null;
    if (!fen || fen.trim().length === 0) {
      fen = extractFenAtPly(g?.pgn ?? "", p?.initialPly);
    }
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

/** Load puzzles from cache; if empty/stale, fetch daily and merge with curated library. */
export async function getOrFetchPuzzles(themes: string[] = []): Promise<LichessPuzzle[]> {
  const cached = loadCachedPuzzles();
  if (cached.length >= 10) return cached;

  const puzzleMap = new Map<string, LichessPuzzle>();

  // 1. Add all 40 verified curated puzzles first
  CURATED_PUZZLES.forEach(p => puzzleMap.set(p.id, p));

  // 2. Fetch daily puzzle from live Lichess API
  try {
    const daily = await fetchDailyPuzzle();
    if (daily) puzzleMap.set(daily.id, daily);
  } catch { /* ignore network error */ }

  // 3. Try fetching live archived Lichess puzzles
  try {
    const liveArchives = await Promise.all(ARCHIVED_LICHESS_IDS.map(fetchPuzzleById));
    liveArchives.filter(Boolean).forEach(p => {
      if (p) puzzleMap.set(p.id, p);
    });
  } catch { /* ignore network error */ }

  const combined = Array.from(puzzleMap.values());
  savePuzzleCache(combined);
  return combined;
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
