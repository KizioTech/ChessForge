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
