/**
 * line-progress.ts: which opening lines you have learned.
 *
 *  new       never practised
 *  learning  practised, but fewer than MASTER_STREAK clean runs in a row
 *  mastered  MASTER_STREAK clean runs in a row (a later unclean run sends it back to learning)
 *
 * Pure logic plus small storage helpers that take the storage as a parameter, so they can be tested.
 * Progress is stored on this device for now.
 */

export const MASTER_STREAK = 3;

export type LineStatus = "new" | "learning" | "mastered";

export interface LineProgress {
  key: string;
  attempts: number;
  cleanRuns: number;
  cleanStreak: number;
  lastPracticedAt: string | null;
}

export type ProgressMap = Record<string, LineProgress>;

export function statusOf(p: LineProgress | undefined): LineStatus {
  if (!p || p.attempts === 0) return "new";
  return p.cleanStreak >= MASTER_STREAK ? "mastered" : "learning";
}

export function recordRun(p: LineProgress | undefined, key: string, clean: boolean, nowIso: string): LineProgress {
  const base: LineProgress = p ?? { key, attempts: 0, cleanRuns: 0, cleanStreak: 0, lastPracticedAt: null };
  return {
    ...base,
    attempts: base.attempts + 1,
    cleanRuns: base.cleanRuns + (clean ? 1 : 0),
    cleanStreak: clean ? base.cleanStreak + 1 : 0,
    lastPracticedAt: nowIso
  };
}

export interface ProgressSummary {
  total: number;
  mastered: number;
  learning: number;
  fresh: number;
}

export function summarizeProgress(keys: string[], map: ProgressMap): ProgressSummary {
  let mastered = 0;
  let learning = 0;
  for (const k of keys) {
    const s = statusOf(map[k]);
    if (s === "mastered") mastered += 1;
    else if (s === "learning") learning += 1;
  }
  return { total: keys.length, mastered, learning, fresh: keys.length - mastered - learning };
}

// ── Storage ────────────────────────────────────────────────────────────────

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function storageKey(userId?: string | null): string {
  return `chessforge:opening_progress_v1:${userId || "local-user"}`;
}

export function loadProgress(userId: string | null | undefined, storage: KeyValueStorage): ProgressMap {
  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ProgressMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const p = v as Partial<LineProgress> | null;
      if (p && typeof p.attempts === "number" && typeof p.cleanStreak === "number") {
        out[k] = {
          key: k,
          attempts: p.attempts,
          cleanRuns: typeof p.cleanRuns === "number" ? p.cleanRuns : 0,
          cleanStreak: p.cleanStreak,
          lastPracticedAt: typeof p.lastPracticedAt === "string" ? p.lastPracticedAt : null
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveProgress(userId: string | null | undefined, map: ProgressMap, storage: KeyValueStorage): void {
  try {
    storage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    /* storage full or unavailable: progress simply is not saved */
  }
}
