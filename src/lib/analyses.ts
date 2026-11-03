/**
 * analyses.ts — Persistence service for game analyses and move evaluations.
 *
 * Supports remote Supabase persistence with seamless LocalStorage caching
 * for unauthenticated sessions, offline use, or immediate retrieval.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  GameAnalysisRecord,
  PositionRecord,
  AnalysisStatus,
  CandidateLine
} from "./engine/types";

const LOCAL_STORAGE_KEY_PREFIX = "chessforge_analysis_";

export interface FullGameAnalysis {
  analysis: GameAnalysisRecord | null;
  positions: PositionRecord[];
}

/**
 * Retrieves the analysis and evaluated positions for a game.
 * Checks remote Supabase first, falling back to local storage cache.
 */
export async function getAnalysisForGame(
  gameId: string,
  userId?: string
): Promise<FullGameAnalysis> {
  const localCache = getLocalAnalysis(gameId);

  if (!isSupabaseConfigured || !userId) {
    return localCache;
  }

  try {
    // 1. Fetch analysis run
    const { data: analysisData, error: analysisErr } = await supabase
      .from("game_analyses")
      .select("*")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (analysisErr || !analysisData) {
      return localCache;
    }

    // 2. Fetch positions for this analysis run
    const { data: positionsData, error: posErr } = await supabase
      .from("positions")
      .select("*")
      .eq("analysis_id", analysisData.id)
      .order("ply", { ascending: true });

    if (posErr || !positionsData) {
      return localCache;
    }

    const full: FullGameAnalysis = {
      analysis: analysisData as GameAnalysisRecord,
      positions: positionsData as PositionRecord[]
    };

    // Cache locally for instant future load
    saveLocalAnalysis(gameId, full);
    return full;
  } catch (err) {
    console.error("Failed to load analysis from Supabase:", err);
    return localCache;
  }
}

/**
 * Saves a full game analysis run and all evaluated positions.
 */
export async function saveAnalysis(
  analysisInput: {
    game_id: string;
    user_id?: string;
    engine_name?: string;
    engine_version?: string;
    depth?: number;
    multipv?: number;
    status?: AnalysisStatus;
    moves_analyzed: number;
    total_moves: number;
  },
  positionsInput: Omit<PositionRecord, "id" | "analysis_id" | "created_at">[]
): Promise<FullGameAnalysis> {
  const analysisId = crypto.randomUUID();
  const now = new Date().toISOString();

  const analysisRecord: GameAnalysisRecord = {
    id: analysisId,
    game_id: analysisInput.game_id,
    user_id: analysisInput.user_id || "local-user",
    engine_name: analysisInput.engine_name || "Stockfish",
    engine_version: analysisInput.engine_version || "16-wasm",
    depth: analysisInput.depth || 16,
    multipv: analysisInput.multipv || 3,
    status: analysisInput.status || "completed",
    moves_analyzed: analysisInput.moves_analyzed,
    total_moves: analysisInput.total_moves,
    completed_at: now,
    created_at: now,
    updated_at: now
  };

  const positionsRecords: PositionRecord[] = positionsInput.map(p => ({
    ...p,
    analysis_id: analysisId,
    user_id: analysisInput.user_id || "local-user"
  }));

  const full: FullGameAnalysis = {
    analysis: analysisRecord,
    positions: positionsRecords
  };

  // Always cache locally
  saveLocalAnalysis(analysisInput.game_id, full);

  // If Supabase is configured and user is signed in with valid UUIDs, sync remotely
  const isRealUuid = (id?: string) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isSupabaseConfigured && isRealUuid(analysisInput.user_id) && isRealUuid(analysisInput.game_id)) {
    try {
      // Upsert analysis run
      const { data: savedAnalysis, error: aErr } = await supabase
        .from("game_analyses")
        .upsert(analysisRecord, { onConflict: "game_id,engine_name,depth" })
        .select()
        .single();

      if (aErr) throw aErr;

      const realAnalysisId = savedAnalysis?.id || analysisId;

      // Upsert positions
      const toInsert = positionsRecords.map(p => ({
        ...p,
        analysis_id: realAnalysisId
      }));

      // Delete old positions for this analysis before inserting
      await supabase.from("positions").delete().eq("analysis_id", realAnalysisId);

      const { error: pErr } = await supabase.from("positions").insert(toInsert);
      if (pErr) throw pErr;

      return {
        analysis: savedAnalysis as GameAnalysisRecord,
        positions: toInsert
      };
    } catch (err) {
      console.error("Supabase analysis save failed (saved locally):", err);
    }
  }

  return full;
}

// --- Local Storage Cache Helpers ---

function getLocalAnalysis(gameId: string): FullGameAnalysis {
  try {
    if (typeof localStorage === "undefined") return { analysis: null, positions: [] };
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${gameId}`);
    if (!raw) return { analysis: null, positions: [] };
    return JSON.parse(raw) as FullGameAnalysis;
  } catch {
    return { analysis: null, positions: [] };
  }
}

function saveLocalAnalysis(gameId: string, full: FullGameAnalysis): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${gameId}`,
      JSON.stringify(full)
    );
  } catch (err) {
    console.warn("Could not write analysis to local storage:", err);
  }
}
