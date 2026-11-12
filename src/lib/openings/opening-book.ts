/**
 * opening-book.ts: offline opening recognition from the Lichess chess-openings
 * dataset (CC0). Pure logic plus a lazy loader. No network, no engine.
 *
 * Positions are matched by board position, not move order, so transpositions
 * resolve to the same opening.
 */
import { Chess } from "chess.js";

export interface BookOpening {
  eco: string;
  name: string;
  pgn: string;
  /** SAN moves of the line, filled in by buildOpeningBook. */
  moves?: string[];
}

export interface OpeningBook {
  size: number;
  byPosition: Map<string, BookOpening>;
  /** Every named line, sorted by ECO code then name. */
  all: BookOpening[];
}

/** "1. e4 e5 2. Nf3" -> ["e4", "e5", "Nf3"] */
export function pgnToSan(pgn: string): string[] {
  return pgn.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean);
}

export interface OpeningMatch {
  opening: BookOpening | null;
  /** Ply (1-based) of the last move that was still inside a named line. 0 if none. */
  bookPly: number;
  /** Ply of the first move after the last named position, or null if the game ended in book. */
  leftBookAtPly: number | null;
}

/** Board + side to move + castling + en passant (only when a capture is legal). */
export function positionKey(chess: Chess): string {
  const [placement, turn, castling, ep] = chess.fen().split(" ");
  const epLegal = ep !== "-" && chess.moves({ verbose: true }).some(m => m.flags.includes("e"));
  return `${placement} ${turn} ${castling} ${epLegal ? ep : "-"}`;
}

export function parseTsv(text: string): BookOpening[] {
  return text
    .split(/\r?\n/)
    .slice(1) // header: eco<TAB>name<TAB>pgn
    .filter(line => line.trim().length > 0)
    .map(line => {
      const [eco, name, pgn] = line.split("\t");
      return { eco, name, pgn };
    })
    .filter(o => o.eco && o.name && o.pgn);
}

/** Build the lookup index. Keys come from replaying each line with chess.js, so they always match lookups. */
export function buildOpeningBook(openings: BookOpening[]): OpeningBook {
  const byPosition = new Map<string, BookOpening>();
  for (const opening of openings) {
    const chess = new Chess();
    try {
      chess.loadPgn(opening.pgn);
    } catch {
      continue; // skip a malformed row rather than break the whole book
    }
    const key = positionKey(chess);
    const existing = byPosition.get(key);
    // If two names reach the same position, keep the more specific (longer) line.
    if (!existing || opening.pgn.length > existing.pgn.length) byPosition.set(key, opening);
  }
  const all = [...byPosition.values()]
    .map(o => ({ ...o, moves: pgnToSan(o.pgn) }))
    .sort((a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name));
  return { size: byPosition.size, byPosition, all };
}

let bookPromise: Promise<OpeningBook> | null = null;

/** Lazy-loaded so the data stays out of the main bundle. Bundled at build time; works offline. */
export function loadOpeningBook(): Promise<OpeningBook> {
  if (!bookPromise) {
    bookPromise = Promise.all([
      import("../../data/openings/a.tsv?raw"),
      import("../../data/openings/b.tsv?raw"),
      import("../../data/openings/c.tsv?raw"),
      import("../../data/openings/d.tsv?raw"),
      import("../../data/openings/e.tsv?raw")
    ]).then(files => buildOpeningBook(files.flatMap(f => parseTsv(f.default))));
  }
  return bookPromise;
}

const MAX_BOOK_PLY = 40;

/** Identify the opening from SAN moves, played from the standard starting position. */
export function identifyOpening(book: OpeningBook, sanMoves: string[]): OpeningMatch {
  const chess = new Chess();
  let opening: BookOpening | null = null;
  let bookPly = 0;
  const limit = Math.min(sanMoves.length, MAX_BOOK_PLY);
  for (let i = 0; i < limit; i++) {
    try {
      chess.move(sanMoves[i]);
    } catch {
      break;
    }
    const hit = book.byPosition.get(positionKey(chess));
    if (hit) {
      opening = hit;
      bookPly = i + 1;
    }
  }
  const leftBookAtPly = opening && bookPly < sanMoves.length ? bookPly + 1 : null;
  return { opening, bookPly, leftBookAtPly };
}

/** Identify from a full PGN. Games from a custom start position are not matched. */
export function identifyOpeningFromPgn(book: OpeningBook, pgn: string): OpeningMatch {
  const none: OpeningMatch = { opening: null, bookPly: 0, leftBookAtPly: null };
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const headers = chess.getHeaders();
    if (headers.SetUp === "1" || headers.FEN) return none;
    return identifyOpening(book, chess.history());
  } catch {
    return none;
  }
}

/** "Sicilian Defense: Najdorf Variation" -> "Sicilian Defense". Use for grouping small samples. */
export function openingFamily(name: string): string {
  return name.split(":")[0].trim();
}

export interface OpeningListOptions {
  category?: "A" | "B" | "C" | "D" | "E" | "all";
  query?: string;
  limit?: number;
  offset?: number;
}

/** Browse or search the catalogue by name, ECO code (for example "B12") or category letter. */
export function listOpenings(book: OpeningBook, opts: OpeningListOptions = {}): { items: BookOpening[]; total: number } {
  const { category = "all", query = "", limit = 50, offset = 0 } = opts;
  const q = query.trim().toLowerCase();
  const filtered = book.all.filter(o =>
    (category === "all" || o.eco.startsWith(category)) &&
    (!q || o.name.toLowerCase().includes(q) || o.eco.toLowerCase() === q)
  );
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

export interface NextBookMove {
  san: string;
  /** How many named lines continue with this move. */
  lines: number;
  /** The shortest named line that continues with this move. */
  example: BookOpening;
}

/** Theory continuations from the moves played so far (same move order; transpositions are not followed). */
export function nextBookMoves(book: OpeningBook, sanMoves: string[], limit = 8): NextBookMove[] {
  const n = sanMoves.length;
  const found = new Map<string, NextBookMove>();
  for (const o of book.all) {
    const m = o.moves ?? [];
    if (m.length <= n) continue;
    let prefix = true;
    for (let i = 0; i < n; i++) if (m[i] !== sanMoves[i]) { prefix = false; break; }
    if (!prefix) continue;
    const san = m[n];
    const cur = found.get(san);
    if (!cur) found.set(san, { san, lines: 1, example: o });
    else {
      cur.lines += 1;
      if ((o.moves?.length ?? 99) < (cur.example.moves?.length ?? 99)) cur.example = o;
    }
  }
  return [...found.values()].sort((a, b) => b.lines - a.lines).slice(0, limit);
}

export interface EcoCategoryMeta {
  code: "A" | "B" | "C" | "D" | "E";
  name: string;
  description: string;
  examples: string;
}

export const ECO_CATEGORIES: EcoCategoryMeta[] = [
  {
    code: "A",
    name: "Flank & Irregular Openings",
    description: "Flank openings and systems not starting with 1.e4 or 1.d4, plus the Dutch Defense.",
    examples: "English, Réti, Bird, Dutch, Benoni",
  },
  {
    code: "B",
    name: "Semi-Open Games",
    description: "1.e4 where Black responds with moves other than 1...e5.",
    examples: "Sicilian, Caro-Kann, Scandinavian, Pirc, Alekhine",
  },
  {
    code: "C",
    name: "Open Games & French",
    description: "1.e4 e5 (Double King Pawn) and the French Defense.",
    examples: "Ruy Lopez, Italian, Scotch, Petroff, French Defense, King's Gambit",
  },
  {
    code: "D",
    name: "Closed Games & Semi-Slav",
    description: "1.d4 d5 (Double Queen Pawn) plus the Grünfeld Defense.",
    examples: "Queen's Gambit, Slav Defense, Semi-Slav, Grünfeld, London System",
  },
  {
    code: "E",
    name: "Indian Defenses",
    description: "1.d4 Nf6 with early ...e6 or ...g6 setups.",
    examples: "King's Indian, Nimzo-Indian, Queen's Indian, Bogo-Indian, Catalan",
  },
];
