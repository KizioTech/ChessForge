/**
 * endgame-progress.ts
 *
 * Persistence and mastery calculations for technical endgame drills.
 */

import type { EndgameProgress, EndgameProgressMap } from "./types";

const STORAGE_KEY = "chessforge:endgame-progress";
export const ENDGAME_MASTER_STREAK = 2; // 2 consecutive clean runs to achieve mastery

export function loadEndgameProgress(): EndgameProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEndgameProgress(progress: EndgameProgressMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore localStorage errors
  }
}

export function recordEndgameRun(
  current: EndgameProgressMap,
  positionId: string,
  clean: boolean
): EndgameProgressMap {
  const existing = current[positionId] ?? {
    attempts: 0,
    cleared: false,
    cleanStreak: 0
  };

  const nextStreak = clean ? existing.cleanStreak + 1 : 0;
  const nextCleared = existing.cleared || nextStreak >= ENDGAME_MASTER_STREAK;

  const updated: EndgameProgress = {
    attempts: existing.attempts + 1,
    cleared: nextCleared,
    cleanStreak: nextStreak,
    lastTrainedAt: new Date().toISOString()
  };

  const nextMap = {
    ...current,
    [positionId]: updated
  };

  saveEndgameProgress(nextMap);
  return nextMap;
}
