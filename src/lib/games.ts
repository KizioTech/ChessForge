/**
 * Games Service — Database CRUD with local storage fallback.
 *
 * Implements:
 * - Supabase persistence with RLS when authenticated
 * - Local storage persistence for unauthenticated / offline sessions
 * - Fingerprint deduplication checking
 * - Game query filtering and sorting
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { remote } from "./remote";
import { dbGetGames, dbPutGames, dbDeleteGame } from "./repository";
import type { ParsedGame, TimeClass } from "./pgn-parser";

export interface GameRecord {
  id: string;
  user_id?: string;
  platform: string;
  external_id?: string;
  fingerprint: string;
  pgn: string;
  white: string;
  black: string;
  white_elo?: number;
  black_elo?: number;
  user_colour: "white" | "black" | "unknown";
  result: string;
  termination?: string;
  time_control?: string;
  time_class?: TimeClass;
  rated: boolean;
  played_at?: string;
  variant: string;
  start_fen?: string;
  source: "upload" | "paste" | "chesscom" | "lichess";
  moves_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaveGamesResult {
  saved: GameRecord[];
  duplicates: { fingerprint: string; white: string; black: string }[];
  failed: { error: string }[];
}

const LOCAL_STORAGE_KEY = "chessforge_local_games_v1";

function getLocalGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalGames(games: GameRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(games));
  } catch (err) {
    console.error("Failed to save local games:", err);
  }
}

/**
 * Fetch all games for the current user (from Supabase if authenticated, or IndexedDB / local storage).
 */
export async function getGames(userId?: string | null): Promise<GameRecord[]> {
  if (isSupabaseConfigured && userId) {
    const result = await remote<GameRecord[]>(
      signal =>
        supabase
          .from("games")
          .select("*")
          .order("played_at", { ascending: false, nullsFirst: false })
          .abortSignal(signal) as any,
      { label: "games.select", timeoutMs: 8000 }
    );

    if (result.ok && result.data) {
      const remoteGames = result.data.map(row => ({
        ...row,
        moves_count: row.moves_count || 0
      })) as GameRecord[];

      if (remoteGames.length > 0) {
        // Cache to IndexedDB for instant offline access
        dbPutGames(remoteGames).catch(() => {});
        return remoteGames;
      }

      // If remote returned 0 games, check IndexedDB then local storage
      const idbGames = await dbGetGames(userId).catch(() => []);
      if (idbGames.length > 0) return idbGames;

      const local = getLocalGames();
      if (local.length > 0) return local;
      return [];
    }
    if (!result.ok) {
      console.warn("Could not fetch remote games from Supabase, checking local repositories:", result.message);
    }
  }

  // Check IndexedDB first, then fallback to local storage
  const idb = await dbGetGames(userId).catch(() => []);
  if (idb.length > 0) return idb;
  return getLocalGames();
}

/**
 * Save newly parsed games with fingerprint deduplication.
 */
export async function saveParsedGames(
  parsedGames: ParsedGame[],
  source: "upload" | "paste" | "chesscom" | "lichess" = "upload",
  userId?: string | null
): Promise<SaveGamesResult> {
  const result: SaveGamesResult = {
    saved: [],
    duplicates: [],
    failed: []
  };

  const existingGames = await getGames(userId);
  const existingFingerprints = new Set(existingGames.map(g => g.fingerprint));

  const newRecords: GameRecord[] = [];

  for (const g of parsedGames) {
    if (existingFingerprints.has(g.fingerprint)) {
      result.duplicates.push({
        fingerprint: g.fingerprint,
        white: g.white,
        black: g.black
      });
      continue;
    }

    // Mark fingerprint as seen within this batch too
    existingFingerprints.add(g.fingerprint);

    const record: GameRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `game_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      user_id: userId || undefined,
      platform: source === "chesscom" || source === "lichess"
        ? source
        : g.headers.Site?.toLowerCase().includes("lichess")
        ? "lichess"
        : g.headers.Site?.toLowerCase().includes("chess.com")
        ? "chesscom"
        : "upload",
      external_id: g.headers.Link || g.headers.GameId,
      fingerprint: g.fingerprint,
      pgn: g.rawPgn,
      white: g.white,
      black: g.black,
      white_elo: g.whiteElo,
      black_elo: g.blackElo,
      user_colour: g.userColour,
      result: g.result,
      termination: g.termination,
      time_control: g.timeControl,
      time_class: g.timeClass,
      rated: Boolean(g.headers.Rated && g.headers.Rated.toLowerCase() === "true"),
      played_at: g.playedAt,
      variant: g.variant,
      start_fen: g.startFen,
      source,
      moves_count: g.moves.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    newRecords.push(record);
  }

  if (newRecords.length === 0) {
    return result;
  }

  // Dual-write to IndexedDB and local storage cache
  dbPutGames(newRecords).catch(() => {});
  const merged = [...newRecords, ...existingGames];
  saveLocalGames(merged);

  // If Supabase is configured and user is signed in, save to database
  if (isSupabaseConfigured && userId) {
    const insertRows = newRecords.map(r => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id);
      const { id, ...rest } = r;
      return isUuid
        ? { ...r, user_id: userId }
        : { ...rest, user_id: userId };
    });

    const res = await remote<GameRecord[]>(
      signal => supabase.from("games").insert(insertRows).abortSignal(signal).select(),
      { label: "games.insert" }
    );

    if (res.ok && res.data) {
      result.saved = res.data as GameRecord[];
    } else {
      console.warn("Supabase insert error (games saved locally):", res.ok ? "No data" : res.message);
      result.saved = newRecords;
    }
  } else {
    // Unauthenticated local session
    result.saved = newRecords;
  }

  return result;
}

/**
 * Delete a game by ID.
 */
export async function deleteGame(gameId: string, userId?: string | null): Promise<boolean> {
  // Always remove from IndexedDB and local storage
  dbDeleteGame(gameId).catch(() => {});
  const existing = getLocalGames();
  const filtered = existing.filter(g => g.id !== gameId);
  saveLocalGames(filtered);

  if (isSupabaseConfigured && userId) {
    const res = await remote(
      signal => supabase.from("games").delete().eq("id", gameId).abortSignal(signal),
      { label: "games.delete" }
    );
    if (!res.ok) {
      console.warn("Remote delete failed:", res.message);
    }
    return true;
  }

  return true;
}

