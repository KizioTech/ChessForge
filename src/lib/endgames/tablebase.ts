/**
 * tablebase.ts — Syzygy 7-piece Endgame Tablebase Integration via Lichess API
 *
 * Implements Phase 8 Tablebase Probing:
 * - Free, public CC0 tablebase endpoint for positions with <= 7 pieces.
 * - Resolves exact theoretical outcomes (Win, Draw, Loss, Cursed Win, Blessed Loss).
 * - Provides distance-to-mate (DTM) and distance-to-zeroing (DTZ).
 * - Client-side bounded caching (100 positions) and graceful offline fallback.
 */

export type TablebaseCategory =
  | "win"
  | "unknown"
  | "maybe-win"
  | "cursed-win"
  | "draw"
  | "blessed-loss"
  | "maybe-loss"
  | "loss";

export interface TablebaseMove {
  uci: string;
  san: string;
  category: TablebaseCategory;
  dtz: number | null;
  preciseDtz?: number | null;
  dtm: number | null;
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
}

export interface TablebaseResult {
  category: TablebaseCategory;
  dtz: number | null;
  preciseDtz?: number | null;
  dtm: number | null;
  checkmate: boolean;
  stalemate: boolean;
  insufficientMaterial: boolean;
  moves: TablebaseMove[];
}

export interface FormattedTablebaseOutcome {
  outcome: "win" | "draw" | "loss" | "unknown";
  headline: string;
  detail: string;
  badgeColor: string;
}

/**
 * Counts total non-empty piece characters on the board from a FEN string.
 */
export function countPieces(fen: string): number {
  if (!fen) return 0;
  const placement = fen.trim().split(/\s+/)[0] || "";
  let pieces = 0;
  for (const ch of placement) {
    if (/[prnbqkPRNBQK]/.test(ch)) {
      pieces++;
    }
  }
  return pieces;
}

/**
 * Checks if a position can be probed in the 7-piece tablebase.
 */
export function canProbeTablebase(fen: string): boolean {
  const pieces = countPieces(fen);
  return pieces >= 2 && pieces <= 7;
}

/**
 * Bounded LRU-style in-memory cache for tablebase probe results.
 */
const CACHE_MAX_SIZE = 120;
const tablebaseCache = new Map<string, TablebaseResult>();

export function clearTablebaseCache(): void {
  tablebaseCache.clear();
}

/**
 * Normalizes a FEN to its 4-part key for caching.
 */
function cacheKeyForFen(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}

/**
 * Query the Lichess 7-piece tablebase API.
 */
export async function probeTablebase(
  fen: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TablebaseResult | null> {
  if (!canProbeTablebase(fen)) return null;

  const key = cacheKeyForFen(fen);
  const cached = tablebaseCache.get(key);
  if (cached) return cached;

  const timeoutMs = options?.timeoutMs ?? 5000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  try {
    const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen.trim())}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" }
    });

    if (!res.ok) return null;
    const data = await res.json();

    const result: TablebaseResult = {
      category: data.category || "unknown",
      dtz: typeof data.dtz === "number" ? data.dtz : null,
      preciseDtz: typeof data.precise_dtz === "number" ? data.precise_dtz : undefined,
      dtm: typeof data.dtm === "number" ? data.dtm : null,
      checkmate: Boolean(data.checkmate),
      stalemate: Boolean(data.stalemate),
      insufficientMaterial: Boolean(data.insufficient_material),
      moves: Array.isArray(data.moves)
        ? data.moves.map((m: any) => ({
            uci: m.uci,
            san: m.san,
            category: m.category || "unknown",
            dtz: typeof m.dtz === "number" ? m.dtz : null,
            preciseDtz: typeof m.precise_dtz === "number" ? m.precise_dtz : undefined,
            dtm: typeof m.dtm === "number" ? m.dtm : null,
            zeroing: Boolean(m.zeroing),
            checkmate: Boolean(m.checkmate),
            stalemate: Boolean(m.stalemate)
          }))
        : []
    };

    if (tablebaseCache.size >= CACHE_MAX_SIZE) {
      const firstKey = tablebaseCache.keys().next().value;
      if (firstKey) tablebaseCache.delete(firstKey);
    }
    tablebaseCache.set(key, result);

    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Format a tablebase result into human-readable text and status color.
 */
export function formatTablebaseOutcome(result: TablebaseResult): FormattedTablebaseOutcome {
  if (result.checkmate) {
    return {
      outcome: "win",
      headline: "Checkmate",
      detail: "Position is delivered checkmate.",
      badgeColor: "#22c55e"
    };
  }

  if (result.stalemate) {
    return {
      outcome: "draw",
      headline: "Stalemate",
      detail: "Position is drawn by stalemate.",
      badgeColor: "#60a5fa"
    };
  }

  switch (result.category) {
    case "win": {
      const moves = result.dtm !== null ? Math.abs(result.dtm) : null;
      const dtz = result.dtz !== null ? Math.abs(result.dtz) : null;
      const detail = moves
        ? `Theoretical Win in ${moves} moves with best play.`
        : dtz
        ? `Theoretical Win (DTZ: ${dtz}).`
        : "Theoretical Win with optimal play.";
      return {
        outcome: "win",
        headline: moves ? `Win in ${moves}` : "Tablebase Win",
        detail,
        badgeColor: "#22c55e"
      };
    }
    case "cursed-win": {
      return {
        outcome: "draw",
        headline: "Cursed Win (Draw)",
        detail: "Winning technically, but drawn due to the 50-move rule.",
        badgeColor: "#eab308"
      };
    }
    case "draw": {
      return {
        outcome: "draw",
        headline: "Tablebase Draw",
        detail: "Position is a theoretical draw with correct play from both sides.",
        badgeColor: "#38bdf8"
      };
    }
    case "blessed-loss": {
      return {
        outcome: "draw",
        headline: "Blessed Loss (Draw)",
        detail: "Losing technically, but defended to a draw by the 50-move rule.",
        badgeColor: "#eab308"
      };
    }
    case "loss": {
      const moves = result.dtm !== null ? Math.abs(result.dtm) : null;
      const detail = moves
        ? `Theoretical Loss in ${moves} moves.`
        : "Theoretical Loss against best play.";
      return {
        outcome: "loss",
        headline: moves ? `Loss in ${moves}` : "Tablebase Loss",
        detail,
        badgeColor: "#ef4444"
      };
    }
    default:
      return {
        outcome: "unknown",
        headline: "Unknown Outcome",
        detail: "Position could not be resolved by the tablebase probe.",
        badgeColor: "var(--muted)"
      };
  }
}
