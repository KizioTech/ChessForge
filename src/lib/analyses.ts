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
  positionsInput: Omit<PositionRecord, "id" | "analysis_id" | "created_at">[],
  options?: { skipRemoteSync?: boolean }
): Promise<FullGameAnalysis> {
  const analysisId = crypto.randomUUID();
  const now = new Date().toISOString();

  const analysisRecord: GameAnalysisRecord = {
    id: analysisId,
    game_id: analysisInput.game_id,
    user_id: analysisInput.user_id || "local-user",
    engine_name: analysisInput.engine_name || "Stockfish",
    engine_version: analysisInput.engine_version || "19-lite-wasm",
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

  // If Supabase is configured and user is signed in with valid UUIDs, sync remotely unless skipped
  const isRealUuid = (id?: string) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (!options?.skipRemoteSync && isSupabaseConfigured && isRealUuid(analysisInput.user_id) && isRealUuid(analysisInput.game_id)) {
    try {
      const engineName = analysisInput.engine_name || "Stockfish";
      const depth = analysisInput.depth || 16;

      // Timeout race to prevent slow network / timed out connections from freezing the app
      const timeoutPromise = new Promise<{ data: null; error: Error }>(resolve =>
        setTimeout(() => resolve({ data: null, error: new Error("Analysis sync network timeout") }), 2000)
      );

      // Check if an analysis already exists for this game, engine, and depth
      const checkPromise = supabase
        .from("game_analyses")
        .select("id")
        .eq("game_id", analysisInput.game_id)
        .eq("engine_name", engineName)
        .eq("depth", depth)
        .maybeSingle();

      const { data: existingAnalysis } = await Promise.race([checkPromise, timeoutPromise]);

      let realAnalysisId: string;
      let savedAnalysis: GameAnalysisRecord;

      if (existingAnalysis?.id) {
        realAnalysisId = existingAnalysis.id;
        // Delete old positions for this analysis before inserting
        await supabase.from("positions").delete().eq("analysis_id", realAnalysisId);

        // Update existing analysis record without modifying its primary key id
        const { id: _ignored, ...updateFields } = analysisRecord;
        const { data: updated, error: uErr } = await supabase
          .from("game_analyses")
          .update({ ...updateFields, updated_at: now })
          .eq("id", realAnalysisId)
          .select()
          .single();

        if (uErr) throw uErr;
        savedAnalysis = updated as GameAnalysisRecord;
      } else {
        // Insert new record
        const { data: inserted, error: iErr } = await supabase
          .from("game_analyses")
          .insert(analysisRecord)
          .select()
          .single();

        if (iErr) throw iErr;
        realAnalysisId = inserted.id;
        savedAnalysis = inserted as GameAnalysisRecord;
      }

      // Insert positions with the confirmed analysis ID
      const toInsert = positionsRecords.map(p => ({
        ...p,
        analysis_id: realAnalysisId
      }));

      const { error: pErr } = await supabase.from("positions").insert(toInsert);
      if (pErr) throw pErr;

      return {
        analysis: savedAnalysis,
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
