/**
 * settings.ts — User configuration and appearance settings.
 *
 * Persisted in LocalStorage with immediate DOM attribute application for themes.
 */

export interface AppSettings {
  // Appearance
  theme: "forge-dark" | "midnight-blue" | "forest-green" | "classic-slate";
  boardTheme: "brown" | "green" | "blue" | "slate";
  showCoordinates: boolean;
  soundEnabled: boolean;

  // Engine
  defaultDepth: number;
  defaultMultiPv: number;
  autoLiveEval: boolean;
  hashMb: number;

  // Training
  dailyGoal: number;
  autoGenerateExercises: boolean;
  autoAdvanceOnCorrect: boolean;
  includeInaccuracies: boolean;

  // Sync / Profiles
  chessComUsername: string;
  lichessUsername: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "forge-dark",
  boardTheme: "brown",
  showCoordinates: true,
  soundEnabled: true,

  defaultDepth: 12,
  defaultMultiPv: 3,
  autoLiveEval: true,
  hashMb: 32,

  dailyGoal: 10,
  autoGenerateExercises: true,
  autoAdvanceOnCorrect: true,
  includeInaccuracies: false,

  chessComUsername: "",
  lichessUsername: ""
};

const LS_SETTINGS_KEY = "chessforge:settings";

export function getSettings(): AppSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...updates };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to persist settings:", err);
    }
  }

  if (updates.theme) {
    applyTheme(updates.theme);
  }

  return updated;
}

export function applyTheme(theme: AppSettings["theme"]): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

