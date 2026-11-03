/**
 * Pure TypeScript PGN Parser & Validator
 *
 * Implements:
 * - Multi-game PGN splitting and streaming
 * - Seven Tag Roster (STR) + supplementary header extraction
 * - Legal move verification via chess.js
 * - Canonical SHA-256 game fingerprint generation
 * - Time control / time class classification
 * - Descriptive error reporting for malformed games
 */

import { Chess } from "chess.js";

export interface ParsedGameHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  WhiteElo?: string;
  BlackElo?: string;
  TimeControl?: string;
  TimeClass?: string;
  Termination?: string;
  SetUp?: string;
  FEN?: string;
  Variant?: string;
  ECO?: string;
  UTCDate?: string;
  UTCTime?: string;
  [key: string]: string | undefined;
}

export type TimeClass = "UltraBullet" | "Bullet" | "Blitz" | "Rapid" | "Classical" | "Daily";

export interface ParsedGame {
  headers: ParsedGameHeaders;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: string;
  termination?: string;
  timeControl?: string;
  timeClass?: TimeClass;
  playedAt?: string; // ISO string
  variant: string;
  startFen?: string;
  finalFen: string;
  moves: string[]; // Validated SAN strings
  normalizedMovetext: string;
  fingerprint: string;
  userColour: "white" | "black" | "unknown";
  rawPgn: string;
  plies: number;
}

export interface ParseError {
  gameIndex: number;
  error: string;
  rawSnippet: string;
}

export interface ParseReport {
  games: ParsedGame[];
  errors: ParseError[];
  totalParsed: number;
}

/**
 * Categorize a TimeControl header into standard chess time classes.
 * Common formats:
 * - "600" or "600+0" (10 mins) -> Rapid
 * - "180+2" (3m + 2s inc) -> 180 + 80 = 260 -> Blitz
 * - "60+0" -> Bullet
 * - "1/86400" -> Daily
 */
export function categorizeTimeControl(tc?: string, explicitClass?: string): TimeClass | undefined {
  if (explicitClass) {
    const norm = explicitClass.toLowerCase();
    if (norm.includes("ultra")) return "UltraBullet";
    if (norm.includes("bullet")) return "Bullet";
    if (norm.includes("blitz")) return "Blitz";
    if (norm.includes("rapid")) return "Rapid";
    if (norm.includes("classic")) return "Classical";
    if (norm.includes("daily") || norm.includes("correspondence")) return "Daily";
  }

  if (!tc || tc === "-" || tc === "?") return undefined;

  // Daily / Correspondence format (e.g. 1/86400, 3/86400)
  if (tc.includes("/")) return "Daily";

  const parts = tc.split("+");
  const baseSeconds = parseInt(parts[0], 10);
  if (isNaN(baseSeconds)) return undefined;

  const incrementSeconds = parts[1] ? parseInt(parts[1], 10) : 0;
  // Standard FIDE/USCF formula: estimated duration = base + 40 * increment
  const estimatedSeconds = baseSeconds + (isNaN(incrementSeconds) ? 0 : 40 * incrementSeconds);

  if (estimatedSeconds < 30) return "UltraBullet";
  if (estimatedSeconds < 180) return "Bullet";
  if (estimatedSeconds < 600) return "Blitz";
  if (estimatedSeconds < 1800) return "Rapid";
  return "Classical";
}

/**
 * Parse standard PGN Date strings (e.g. "2026.11.03", "2026.11.??", "2026-11-03")
 * along with optional Time ("14:30:00") into an ISO timestamp.
 */
export function parsePgnDate(dateStr?: string, timeStr?: string): string | undefined {
  if (!dateStr || dateStr.includes("????")) return undefined;

  // Normalize delimiters to "-"
  const cleanedDate = dateStr.replace(/\./g, "-").replace(/\?/g, "01");
  const time = timeStr && !timeStr.includes("?") ? timeStr : "00:00:00";

  try {
    const d = new Date(`${cleanedDate}T${time}Z`);
    return !isNaN(d.getTime()) ? d.toISOString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Calculates a canonical SHA-256 fingerprint for a game based on:
 * normalised_movetext + "|" + white + "|" + black + "|" + date
 */
export async function computeGameFingerprint(
  normalizedMoves: string,
  white: string,
  black: string,
  date?: string
): Promise<string> {
  const whiteClean = (white || "").toLowerCase().trim();
  const blackClean = (black || "").toLowerCase().trim();
  const dateClean = (date || "").trim();
  const payload = `${normalizedMoves}|${whiteClean}|${blackClean}|${dateClean}`;

  const hashBuffer = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload)
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Splits raw PGN file text containing one or multiple games into separate game strings.
 */
export function splitPgnGames(pgnText: string): string[] {
  if (!pgnText || !pgnText.trim()) return [];

  const lines = pgnText.replace(/\r\n/g, "\n").split("\n");
  const games: string[] = [];
  let currentGame: string[] = [];
  let inMoves = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTag = line.trimStart().startsWith("[");

    // If we've seen moves and now hit a new tag, that's the start of the next game
    if (isTag && inMoves) {
      if (currentGame.length > 0) {
        games.push(currentGame.join("\n").trim());
        currentGame = [];
        inMoves = false;
      }
    }

    if (!isTag && line.trim().length > 0) {
      inMoves = true;
    }

    currentGame.push(line);
  }

  if (currentGame.length > 0 && currentGame.join("").trim().length > 0) {
    games.push(currentGame.join("\n").trim());
  }

  return games;
}

/**
 * Determine the user's color in a game based on their account username or email.
 */
export function detectUserColour(
  white: string,
  black: string,
  usernameOrEmail?: string
): "white" | "black" | "unknown" {
  if (!usernameOrEmail) return "unknown";

  const target = usernameOrEmail.toLowerCase().trim();
  const w = white.toLowerCase().trim();
  const b = black.toLowerCase().trim();

  const matchesWhite = w === target || w.includes(target) || target.includes(w);
  const matchesBlack = b === target || b.includes(target) || target.includes(b);

  if (matchesWhite && !matchesBlack) return "white";
  if (matchesBlack && !matchesWhite) return "black";
  return "unknown";
}

/**
 * Parse and validate a single or multi-game PGN string.
 *
 * @param pgnText Full PGN text (one or multiple games).
 * @param currentUsername Optional user identifier for user_colour detection.
 */
export async function parsePgn(
  pgnText: string,
  currentUsername?: string
): Promise<ParseReport> {
  const rawGames = splitPgnGames(pgnText);
  const games: ParsedGame[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < rawGames.length; i++) {
    const raw = rawGames[i];
    if (!raw.trim()) continue;

    try {
      // First extract headers manually to detect custom FEN
      const headerRegex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
      const headers: ParsedGameHeaders = {};
      let match: RegExpExecArray | null;

      while ((match = headerRegex.exec(raw)) !== null) {
        headers[match[1]] = match[2];
      }

      // Initialize chess instance with custom start FEN if SetUp is 1
      const startFen = headers.SetUp === "1" && headers.FEN ? headers.FEN : undefined;
      const chess = new Chess(startFen);

      // Load PGN into chess.js
      chess.loadPgn(raw, { strict: false });

      const moves = chess.history();
      const normalizedMovetext = moves.join(" ");

      const white = headers.White?.trim() || "White";
      const black = headers.Black?.trim() || "Black";
      const date = headers.Date || headers.UTCDate;

      const fingerprint = await computeGameFingerprint(
        normalizedMovetext,
        white,
        black,
        date
      );

      const whiteElo = headers.WhiteElo ? parseInt(headers.WhiteElo, 10) : undefined;
      const blackElo = headers.BlackElo ? parseInt(headers.BlackElo, 10) : undefined;

      const timeClass = categorizeTimeControl(headers.TimeControl, headers.TimeClass);
      const playedAt = parsePgnDate(date, headers.Time || headers.UTCTime);
      const userColour = detectUserColour(white, black, currentUsername);

      games.push({
        headers,
        white,
        black,
        whiteElo: !isNaN(whiteElo as number) ? whiteElo : undefined,
        blackElo: !isNaN(blackElo as number) ? blackElo : undefined,
        result: headers.Result || "*",
        termination: headers.Termination,
        timeControl: headers.TimeControl,
        timeClass,
        playedAt,
        variant: headers.Variant || "standard",
        startFen,
        finalFen: chess.fen(),
        moves,
        normalizedMovetext,
        fingerprint,
        userColour,
        rawPgn: raw,
        plies: moves.length
      });
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to parse game PGN";
      const snippet = raw.slice(0, 140).replace(/\n/g, " ") + (raw.length > 140 ? "..." : "");
      errors.push({
        gameIndex: i + 1,
        error: errorMsg,
        rawSnippet: snippet
      });
    }
  }

  return {
    games,
    errors,
    totalParsed: rawGames.length
  };
}

