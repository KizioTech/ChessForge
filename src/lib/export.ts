/**
 * export.ts — User Data Sovereignty & Export (FR-112).
 *
 * Implements full PGN export and comprehensive JSON data backup.
 */

import type { GameRecord } from "./games";

/**
 * Concatenates all games into a standard multi-game PGN text stream.
 */
export function exportGamesToPgn(games: GameRecord[]): string {
  return games.map(g => g.pgn.trim()).join("\n\n") + "\n";
}

/**
 * Triggers a browser file download of text content with a given filename and mime type.
 */
export function triggerDownload(content: string, filename: string, mimeType: string = "text/plain") {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Compiles a comprehensive backup of all client state into a structured JSON string.
 */
export function exportAllDataAsJson(games: GameRecord[]): string {
  const safeGet = (key: string) => {
    try {
      if (typeof localStorage === "undefined") return [];
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  };

  const backup = {
    exportedAt: new Date().toISOString(),
    version: "1.0.0",
    appName: "ChessForge",
    games,
    mistakes: safeGet("chessforge:mistakes"),
    exercises: safeGet("chessforge:exercises"),
    schedule: safeGet("chessforge:schedule"),
    attempts: safeGet("chessforge:attempts")
  };

  return JSON.stringify(backup, null, 2);
}
