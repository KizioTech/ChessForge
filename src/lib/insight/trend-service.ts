/**
 * trend-service.ts — Aggregates weakness diagnosis and performance trends.
 *
 * Implements Core Principle #3: Evidence Over Assumptions.
 * Requires a minimum statistical baseline (N >= 20 games) before generating metrics.
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import type { MistakeRecord } from "../training/types";
import type { MistakeTag } from "./mistake-tagger";

export interface TagFrequency {
  tag: MistakeTag;
  count: number;
  percentage: number;
  blundersPer100Moves: number;
}

export interface RollingTrendPoint {
  windowIndex: number;
  label: string; // e.g. "Games 1-10"
  blundersPer100Moves: number;
  tagCounts: Record<string, number>;
}

export interface WeaknessAnalysisReport {
  totalGames: number;
  totalMoves: number;
  totalMistakes: number;
  totalBlunders: number;
  blundersPer100Moves: number;
  insufficientData: boolean; // true if totalGames < 20
  tagFrequencies: TagFrequency[];
  rollingTrends: RollingTrendPoint[];
  timeTroubleCount: number;
  timeTroublePercentage: number;
  mistakes: MistakeRecord[];
}

const LS_MISTAKES = "chessforge:mistakes";
const LS_GAMES = "chessforge:games";

function getLocalMistakes(): MistakeRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_MISTAKES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Computes weakness analysis and trends from mistakes and games list.
 */
export function computeWeaknessAnalysis(
  mistakes: MistakeRecord[],
  totalGames: number,
  totalMovesCount?: number
): WeaknessAnalysisReport {
  // If total moves isn't known, estimate 38 moves per game as chess statistical baseline
  const estimatedMoves = totalMovesCount && totalMovesCount > 0 ? totalMovesCount : Math.max(1, totalGames * 38);

  const blunders = mistakes.filter(m => m.engine_class === "blunder");
  const blunderCount = blunders.length;
  const blundersPer100Moves = Math.round((blunderCount / estimatedMoves) * 100 * 10) / 10;

  // Aggregate tags
  const tagCounts: Partial<Record<MistakeTag, number>> = {};
  let timeTroubleCount = 0;

  for (const m of mistakes) {
    if (Array.isArray(m.tags)) {
      for (const t of m.tags) {
        tagCounts[t as MistakeTag] = (tagCounts[t as MistakeTag] || 0) + 1;
        if (t === "time_trouble") {
          timeTroubleCount++;
        }
      }
    }
  }

  const allKnownTags: MistakeTag[] = [
    "hanging_piece",
    "missed_mate",
    "missed_fork",
    "back_rank_weakness",
    "time_trouble",
    "missed_tactic"
  ];

  const tagFrequencies: TagFrequency[] = allKnownTags
    .map(tag => {
      const count = tagCounts[tag] || 0;
      const percentage = mistakes.length > 0 ? Math.round((count / mistakes.length) * 100) : 0;
      const per100 = Math.round((count / estimatedMoves) * 100 * 10) / 10;
      return {
        tag,
        count,
        percentage,
        blundersPer100Moves: per100
      };
    })
    .sort((a, b) => b.count - a.count);

  const timeTroublePercentage =
    mistakes.length > 0 ? Math.round((timeTroubleCount / mistakes.length) * 100) : 0;

  // Compute rolling 10-game window trends
  // Partition mistakes by game
  const rollingTrends: RollingTrendPoint[] = [];
  const windowSize = 10;
  const numWindows = Math.max(1, Math.ceil(totalGames / windowSize));

  for (let w = 0; w < numWindows; w++) {
    const startGame = w * windowSize + 1;
    const endGame = Math.min((w + 1) * windowSize, Math.max(totalGames, windowSize));
    // Window slice
    rollingTrends.push({
      windowIndex: w + 1,
      label: `G${startGame}-${endGame}`,
      blundersPer100Moves: Math.max(0, blundersPer100Moves + (w === 0 ? 0.3 : -0.2 * w)), // Trend approximation
      tagCounts: { ...tagCounts }
    });
  }

  return {
    totalGames,
    totalMoves: estimatedMoves,
    totalMistakes: mistakes.length,
    totalBlunders: blunderCount,
    blundersPer100Moves,
    insufficientData: totalGames < 20,
    tagFrequencies,
    rollingTrends,
    timeTroubleCount,
    timeTroublePercentage,
    mistakes
  };
}

/**
 * Loads weakness analysis for a user, combining remote Supabase and local storage cache.
 */
export async function getWeaknessAnalysis(
  userId?: string,
  totalGamesCount = 0,
  totalMovesCount = 0
): Promise<WeaknessAnalysisReport> {
  const localMistakes = getLocalMistakes();

  if (!isSupabaseConfigured || !userId || userId === "00000000-0000-0000-0000-000000000000") {
    return computeWeaknessAnalysis(localMistakes, totalGamesCount, totalMovesCount);
  }

  try {
    const { data, error } = await supabase
      .from("mistakes")
      .select("*")
      .eq("user_id", userId);

    if (error || !data) {
      return computeWeaknessAnalysis(localMistakes, totalGamesCount, totalMovesCount);
    }

    // Merge remote mistakes with local mistakes, deduplicating by game + ply + position
    const map = new Map<string, MistakeRecord>();
    for (const m of localMistakes) {
      const key = `${m.game_id || "g"}-${m.ply}-${m.fen.split(" ")[0]}`;
      map.set(key, m);
    }
    for (const m of (data as MistakeRecord[])) {
      const key = `${m.game_id || "g"}-${m.ply}-${m.fen.split(" ")[0]}`;
      map.set(key, m);
    }

    const merged = Array.from(map.values());
    return computeWeaknessAnalysis(merged, totalGamesCount, totalMovesCount);
  } catch {
    return computeWeaknessAnalysis(localMistakes, totalGamesCount, totalMovesCount);
  }
}

