/**
 * ECO Opening Book Integration (`@chess-openings/eco.json`)
 *
 * Provides:
 * - 16,000+ canonical chess openings from eco.json (Lichess, SCID, ECO-TSV)
 * - Real-time opening name & ECO code lookup by FEN or moves
 * - Nearest opening detection via `lookupByMoves`
 * - Candidate theoretical continuations via `getFromTos`
 * - Search by opening name or ECO code to import theoretical lines
 */

import type { Chess } from "chess.js";

export interface EcoOpeningInfo {
  name: string;
  eco: string;
  moves: string;
  fen?: string;
  isEcoRoot?: boolean;
}

export interface TheoreticalMoveOption {
  name: string;
  eco: string;
  moves: string;
  targetFen: string;
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

let _openingBookPromise: Promise<{
  book: Record<string, any>;
  positionBook: Record<string, string[]>;
  ecoModule: any;
}> | null = null;

/**
 * Lazy-load the opening book and position lookup index once.
 */
async function getOpeningBookInstance() {
  if (!_openingBookPromise) {
    _openingBookPromise = (async () => {
      try {
        const ecoModule = await import("@chess-openings/eco.json");
        const book = await ecoModule.openingBook();
        const positionBook = ecoModule.getPositionBook(book);
        return { book, positionBook, ecoModule };
      } catch (err) {
        console.warn("[ECO Book] Could not fetch opening database:", err);
        return { book: {}, positionBook: {}, ecoModule: null };
      }
    })();
  }
  return _openingBookPromise;
}

/**
 * Look up the exact or closest opening for a given Chess game instance.
 * Walks backward through move history if the current position is past book.
 */
export async function identifyOpeningFromGame(
  chess: Chess
): Promise<{ opening: EcoOpeningInfo | null; movesBack: number }> {
  try {
    const { book, positionBook, ecoModule } = await getOpeningBookInstance();
    if (!ecoModule || Object.keys(book).length === 0) {
      return { opening: null, movesBack: 0 };
    }

    const result = ecoModule.lookupByMoves(chess, book, {
      positionBook,
      maxMovesBack: 30,
    });

    if (result && result.opening) {
      return {
        opening: {
          name: result.opening.name,
          eco: result.opening.eco,
          moves: result.opening.moves,
          fen: result.opening.fen,
          isEcoRoot: result.opening.isEcoRoot,
        },
        movesBack: result.movesBack ?? 0,
      };
    }
  } catch (err) {
    console.warn("[ECO Book] identifyOpeningFromGame error:", err);
  }

  return { opening: null, movesBack: 0 };
}

/**
 * Look up an opening by FEN string.
 */
export async function identifyOpeningByFen(fen: string): Promise<EcoOpeningInfo | null> {
  try {
    const { book, positionBook, ecoModule } = await getOpeningBookInstance();
    if (!ecoModule || Object.keys(book).length === 0) {
      return null;
    }

    const op = ecoModule.findOpening(book, fen, positionBook);
    if (op) {
      return {
        name: op.name,
        eco: op.eco,
        moves: op.moves,
        fen: op.fen,
        isEcoRoot: op.isEcoRoot,
      };
    }
  } catch (err) {
    console.warn("[ECO Book] identifyOpeningByFen error:", err);
  }
  return null;
}

/**
 * Get theoretical continuation openings from the current position.
 */
export async function getTheoreticalTransitions(
  fen: string
): Promise<TheoreticalMoveOption[]> {
  try {
    const { book, ecoModule } = await getOpeningBookInstance();
    if (!ecoModule || Object.keys(book).length === 0) {
      return [];
    }

    const { next } = await ecoModule.getFromTos(fen, book);
    if (!next || !Array.isArray(next)) return [];

    return next.slice(0, 8).map((op: any) => ({
      name: op.name,
      eco: op.eco,
      moves: op.moves,
      targetFen: op.fen || "",
    }));
  } catch (err) {
    console.warn("[ECO Book] getTheoreticalTransitions error:", err);
    return [];
  }
}

/**
 * Search the 16,000+ opening catalog by keyword or ECO code (e.g. "Caro", "Sicilian", "B12").
 */
export async function searchEcoOpenings(
  query: string,
  limit = 25
): Promise<EcoOpeningInfo[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  try {
    const { book } = await getOpeningBookInstance();
    const results: EcoOpeningInfo[] = [];

    for (const [fen, op] of Object.entries(book)) {
      if (
        op.name?.toLowerCase().includes(q) ||
        op.eco?.toLowerCase() === q ||
        op.moves?.toLowerCase().includes(q)
      ) {
        results.push({
          name: op.name,
          eco: op.eco,
          moves: op.moves,
          fen,
          isEcoRoot: op.isEcoRoot,
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  } catch {
    return [];
  }
}

export interface GetOpeningsListOptions {
  category?: "A" | "B" | "C" | "D" | "E" | "all";
  query?: string;
  rootsOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Fetch a structured, filterable list of openings with pagination.
 */
export async function getOpeningsList(
  options: GetOpeningsListOptions = {}
): Promise<{ items: EcoOpeningInfo[]; total: number }> {
  const { category = "all", query = "", rootsOnly = false, limit = 50, offset = 0 } = options;
  const q = query.trim().toLowerCase();

  try {
    const { book, ecoModule } = await getOpeningBookInstance();
    if (!ecoModule || Object.keys(book).length === 0) {
      return { items: [], total: 0 };
    }

    let sourceList: any[] = [];

    if (rootsOnly) {
      const roots = await ecoModule.getEcoRoots();
      sourceList = Object.values(roots);
    } else if (category !== "all") {
      sourceList = await ecoModule.getOpeningsByEcoCategory(category, book);
    } else {
      sourceList = Object.values(book);
    }

    // Filter by category if rootsOnly was used but a specific category was chosen
    if (category !== "all" && rootsOnly) {
      sourceList = sourceList.filter(op => op.eco?.startsWith(category));
    }

    // Filter by query if provided
    if (q) {
      sourceList = sourceList.filter(
        op =>
          op.name?.toLowerCase().includes(q) ||
          op.eco?.toLowerCase() === q ||
          op.moves?.toLowerCase().includes(q)
      );
    }

    const total = sourceList.length;
    const paginated = sourceList.slice(offset, offset + limit).map((op: any) => ({
      name: op.name,
      eco: op.eco,
      moves: op.moves,
      fen: op.fen,
      isEcoRoot: op.isEcoRoot,
    }));

    return { items: paginated, total };
  } catch (err) {
    console.warn("[ECO Book] getOpeningsList error:", err);
    return { items: [], total: 0 };
  }
}

