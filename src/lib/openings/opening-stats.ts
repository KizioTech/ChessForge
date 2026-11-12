/**
 * opening-stats.ts: results by opening, from the user's point of view.
 * Pure functions. Pass in the games and the loaded book.
 */
import { identifyOpeningFromPgn, openingFamily, type OpeningBook } from "./opening-book";

export interface StatGame {
  pgn: string;
  result: string; // "1-0", "0-1", "1/2-1/2", "*"
  user_colour: "white" | "black" | "unknown" | string;
}

export interface OpeningStat {
  family: string;
  colour: "white" | "black";
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Average ply at which the user's games left known theory. */
  avgLeftBookPly: number | null;
}

function outcome(result: string, colour: "white" | "black"): "win" | "draw" | "loss" | null {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return colour === "white" ? "win" : "loss";
  if (result === "0-1") return colour === "black" ? "win" : "loss";
  return null; // unfinished or unknown
}

export function openingStats(games: StatGame[], book: OpeningBook, minGames = 1): OpeningStat[] {
  const acc = new Map<string, OpeningStat & { leftSum: number; leftN: number }>();
  for (const g of games) {
    if (g.user_colour !== "white" && g.user_colour !== "black") continue;
    const res = outcome(g.result, g.user_colour);
    if (!res) continue;
    const m = identifyOpeningFromPgn(book, g.pgn);
    const family = m.opening ? openingFamily(m.opening.name) : "Unrecognised opening";
    const key = `${g.user_colour}|${family}`;
    const row = acc.get(key) ?? {
      family, colour: g.user_colour, games: 0, wins: 0, draws: 0, losses: 0,
      avgLeftBookPly: null, leftSum: 0, leftN: 0
    };
    row.games += 1;
    if (res === "win") row.wins += 1;
    else if (res === "draw") row.draws += 1;
    else row.losses += 1;
    if (m.leftBookAtPly !== null) { row.leftSum += m.leftBookAtPly; row.leftN += 1; }
    acc.set(key, row);
  }
  return [...acc.values()]
    .filter(r => r.games >= minGames)
    .map(({ leftSum, leftN, ...r }) => ({
      ...r,
      avgLeftBookPly: leftN ? Math.round((leftSum / leftN) * 10) / 10 : null
    }))
    .sort((a, b) => b.games - a.games);
}
