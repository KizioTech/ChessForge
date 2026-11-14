/**
 * opening-recommendations.ts
 *
 * Intelligent opening analysis & recommendations based on previous games:
 * 1. Pinpoints common theoretical lines missed (exact move and mainline alternative).
 * 2. Recommends openings to repair (low win-rate / early departure) or deepen (strengths).
 * 3. Suggests repertoire coverage based on opponent responses.
 *
 * Pure TypeScript — no React, no DOM.
 */

import { Chess } from "chess.js";
import {
  identifyOpening,
  nextBookMoves,
  openingFamily,
  positionKey,
  type BookOpening,
  type OpeningBook
} from "./opening-book";
import { openingStats, type OpeningStat, type StatGame } from "./opening-stats";

export interface MissedBookOption {
  san: string;
  lineCount: number;
  variationName: string;
}

export interface MissedLineStat {
  openingFamily: string;
  eco: string;
  userColour: "white" | "black";
  moveNumber: number;
  ply: number;
  fenBefore: string;
  playedSan: string;
  frequency: number;
  wins: number;
  draws: number;
  losses: number;
  missedOptions: MissedBookOption[];
}

export type RecommendationType = "repair" | "deepen" | "gap" | "trap";

export interface OpeningRecommendation {
  id: string;
  type: RecommendationType;
  openingFamily: string;
  side: "white" | "black";
  title: string;
  reason: string;
  suggestedLine?: string;
  score?: number; // Win/draw score percentage (0-100)
  gamesCount?: number;
  priority: number; // 1 (highest) to 5
}

/**
 * Scan played games to detect positions where the USER left known book theory,
 * what move they played instead, and which common book continuations were missed.
 */
export function findMissedTheoryLines(
  games: StatGame[],
  book: OpeningBook,
  minFrequency = 1
): MissedLineStat[] {
  // Key: `${userColour}|${family}|${ply}|${playedSan}`
  const grouped = new Map<string, MissedLineStat>();

  for (const g of games) {
    if (g.user_colour !== "white" && g.user_colour !== "black") continue;
    if (!g.pgn) continue;

    const userColour = g.user_colour as "white" | "black";
    const chess = new Chess();
    try {
      chess.loadPgn(g.pgn);
    } catch {
      continue;
    }

    const history = chess.history();
    if (history.length === 0) continue;

    const { opening, bookPly, leftBookAtPly } = identifyOpening(book, history);
    if (!opening || !leftBookAtPly || bookPly >= history.length) {
      continue;
    }

    const isUserTurn =
      userColour === "white" ? leftBookAtPly % 2 === 1 : leftBookAtPly % 2 === 0;

    // We only care when the USER left theory, not when the opponent did
    if (!isUserTurn) {
      continue;
    }

    const playedSan = history[leftBookAtPly - 1];
    const movesBefore = history.slice(0, bookPly);
    const bookOptions = nextBookMoves(book, movesBefore, 4);

    // If there were no book continuation moves at that position, it's just the end of book
    if (bookOptions.length === 0) {
      continue;
    }

    // Also get FEN right before the deviation
    const sim = new Chess();
    for (let i = 0; i < movesBefore.length; i++) {
      try { sim.move(movesBefore[i]); } catch { break; }
    }
    const fenBeforeDeviation = sim.fen();

    const family = openingFamily(opening.name);
    const moveNumber = Math.ceil(leftBookAtPly / 2);
    const key = `${userColour}|${family}|${leftBookAtPly}|${playedSan}`;

    const existing = grouped.get(key);
    const result = g.result;
    const isWin =
      (result === "1-0" && userColour === "white") ||
      (result === "0-1" && userColour === "black");
    const isDraw = result === "1/2-1/2";
    const isLoss =
      (result === "0-1" && userColour === "white") ||
      (result === "1-0" && userColour === "black");

    if (existing) {
      existing.frequency += 1;
      if (isWin) existing.wins += 1;
      else if (isDraw) existing.draws += 1;
      else if (isLoss) existing.losses += 1;
    } else {
      grouped.set(key, {
        openingFamily: family,
        eco: opening.eco,
        userColour,
        moveNumber,
        ply: leftBookAtPly,
        fenBefore: fenBeforeDeviation,
        playedSan,
        frequency: 1,
        wins: isWin ? 1 : 0,
        draws: isDraw ? 1 : 0,
        losses: isLoss ? 1 : 0,
        missedOptions: bookOptions.map(o => ({
          san: o.san,
          lineCount: o.lines,
          variationName: o.example.name.split(":").slice(-1)[0]?.trim() || o.example.name
        }))
      });
    }
  }

  return [...grouped.values()]
    .filter(m => m.frequency >= minFrequency)
    .sort((a, b) => b.frequency - a.frequency || a.moveNumber - b.moveNumber);
}

/**
 * Generate intelligent recommendations based on game history and missed lines.
 */
export function generateOpeningRecommendations(
  stats: OpeningStat[],
  missedLines: MissedLineStat[],
  totalGames: number
): OpeningRecommendation[] {
  const recommendations: OpeningRecommendation[] = [];

  // 1. Weakness / Repair recommendations (low score or very early theory exit)
  for (const s of stats) {
    const score = Math.round(((s.wins + s.draws * 0.5) / s.games) * 100);
    const earlyExit = s.avgLeftBookPly !== null && s.avgLeftBookPly <= 6; // Move 3 or earlier

    if (s.games >= 2 && (score < 45 || earlyExit)) {
      const isWeakScore = score < 45;
      recommendations.push({
        id: `repair-${s.colour}-${s.family}`,
        type: "repair",
        openingFamily: s.family,
        side: s.colour,
        title: `Repair your ${s.family} as ${s.colour === "white" ? "White" : "Black"}`,
        reason: isWeakScore
          ? `Low score of ${score}% over ${s.games} games (${s.wins}W / ${s.draws}D / ${s.losses}L). Studying master lines will help you avoid early positional traps.`
          : `You exit known theory early (average Move ${Math.ceil((s.avgLeftBookPly ?? 6) / 2)}). Deepening your core moves will keep you in prepared territory.`,
        suggestedLine: s.family,
        score,
        gamesCount: s.games,
        priority: 1
      });
    }
  }

  // 2. Theory Gap recommendations (frequently missed book continuations)
  const topMisses = missedLines.slice(0, 3);
  for (const m of topMisses) {
    const mainOption = m.missedOptions[0];
    if (!mainOption) continue;

    // Check if we already have a repair recommendation for this family
    const existing = recommendations.find(
      r => r.openingFamily === m.openingFamily && r.side === m.userColour
    );
    if (!existing) {
      recommendations.push({
        id: `gap-${m.userColour}-${m.openingFamily}-${m.ply}`,
        type: "gap",
        openingFamily: m.openingFamily,
        side: m.userColour,
        title: `Missed Theory: ${m.openingFamily} (Move ${m.moveNumber})`,
        reason: `In ${m.frequency} game${m.frequency === 1 ? "" : "s"}, you played ${m.playedSan} instead of the popular mainline ${mainOption.san} (${mainOption.variationName}, ${mainOption.lineCount} lines).`,
        suggestedLine: `${m.openingFamily}: ${mainOption.variationName}`,
        gamesCount: m.frequency,
        priority: 2
      });
    }
  }

  // 3. Deepen strengths (openings where player is already scoring very well)
  for (const s of stats) {
    const score = Math.round(((s.wins + s.draws * 0.5) / s.games) * 100);
    if (s.games >= 2 && score >= 60) {
      recommendations.push({
        id: `deepen-${s.colour}-${s.family}`,
        type: "deepen",
        openingFamily: s.family,
        side: s.colour,
        title: `Deepen your weapon: ${s.family}`,
        reason: `Strong ${score}% win rate across ${s.games} games. Master deeper tactical variations (e.g. 8–12 moves) to turn your opening advantage into decisive wins.`,
        suggestedLine: s.family,
        score,
        gamesCount: s.games,
        priority: 3
      });
    }
  }

  // 4. Fallback / Beginner foundations if player has few games or no clear opening stats
  if (recommendations.length === 0) {
    recommendations.push(
      {
        id: "starter-white-italian",
        type: "gap",
        openingFamily: "Italian Game",
        side: "white",
        title: "Recommended for White: Italian Game",
        reason: "The most principled opening for White. Teaches rapid piece development, central control, and king safety.",
        suggestedLine: "Italian Game: Giuoco Piano",
        priority: 4
      },
      {
        id: "starter-black-caro",
        type: "gap",
        openingFamily: "Caro-Kann Defense",
        side: "black",
        title: "Recommended for Black vs 1. e4: Caro-Kann",
        reason: "A rock-solid response against 1. e4 with a clear pawn structure and minimal tactical vulnerabilities.",
        suggestedLine: "Caro-Kann Defense: Classical Variation",
        priority: 4
      },
      {
        id: "starter-black-qgd",
        type: "gap",
        openingFamily: "Queen's Gambit Declined",
        side: "black",
        title: "Recommended for Black vs 1. d4: Queen's Gambit Declined",
        reason: "A classical, time-tested defense that directly challenges White's central space.",
        suggestedLine: "Queen's Gambit Declined: Tartakower Defense",
        priority: 5
      }
    );
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
