/**
 * fast-batch-analyzer.ts — Fast client-side library screening for weakness diagnosis.
 *
 * IMPORTANT: This scanner uses a material-count + 1-ply quiescence heuristic, NOT a real
 * chess engine (see ADR-0004 for engine contracts). It is intentionally "screening only":
 *
 *   ✓ Saves tagged MistakeRecords locally for the weakness radar and Analytics view.
 *   ✗ Does NOT generate TrainingExercises — those require verified Stockfish analysis.
 *   ✗ Does NOT save game_analyses or position records to Supabase.
 *
 * The "best move" produced here is a heuristic guess. Users should open individual games
 * in the Analysis workspace (Stockfish depth ≥ 12) for verified exercise generation.
 */

import { Chess, type Square } from "chess.js";
import type { GameRecord } from "../games";
import type { PositionRecord, CandidateLine, MoveAnalysisReport, MoveClassification } from "./types";
import { calculateWinProbability, getMoverWinProbability, classifyMove } from "./win-probability";
import { tagMistake } from "../insight/mistake-tagger";
import { syncLocalTrainingToSupabase } from "../training/training-service";
import type { MistakeRecord } from "../training/types";

// Local storage key for the screening mistakes cache (separate from full exercise mistakes)
const LS_SCREENING_MISTAKES = "chessforge:mistakes";

function saveScreeningMistakes(newMistakes: MistakeRecord[]): void {
  try {
    const existing: MistakeRecord[] = JSON.parse(localStorage.getItem(LS_SCREENING_MISTAKES) || "[]");
    const map = new Map<string, MistakeRecord>();
    existing.forEach(m => map.set(`${m.game_id}-${m.ply}`, m));
    newMistakes.forEach(m => map.set(`${m.game_id}-${m.ply}`, m));
    localStorage.setItem(LS_SCREENING_MISTAKES, JSON.stringify(Array.from(map.values())));
  } catch {
    // ignore storage errors
  }
}

const PIECE_VALS: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

function evaluateFenHeuristic(chess: Chess): { scoreCp: number; mateIn: number | null } {
  if (chess.isCheckmate()) {
    return {
      scoreCp: chess.turn() === "w" ? -30000 : 30000,
      mateIn: chess.turn() === "w" ? -1 : 1
    };
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return { scoreCp: 0, mateIn: null };
  }

  let whiteMat = 0;
  let blackMat = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = PIECE_VALS[piece.type] || 0;
        // Positional center bonus
        const centerBonus = (r >= 3 && r <= 4 && c >= 3 && c <= 4) ? 20 : 0;
        if (piece.color === "w") whiteMat += (val + centerBonus);
        else blackMat += (val + centerBonus);
      }
    }
  }

  return { scoreCp: whiteMat - blackMat, mateIn: null };
}

/**
 * Evaluates position including 1-ply tactical replies (quiescence captures & checks)
 * to immediately penalize hanging pieces and detect tactical shots.
 */
function evaluateTacticalPosition(chess: Chess): { scoreCp: number; mateIn: number | null } {
  if (chess.isCheckmate()) {
    return {
      scoreCp: chess.turn() === "w" ? -30000 : 30000,
      mateIn: chess.turn() === "w" ? -1 : 1
    };
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return { scoreCp: 0, mateIn: null };
  }

  const baseEval = evaluateFenHeuristic(chess);
  const sideToMove = chess.turn();

  const replies = chess.moves({ verbose: true });
  if (replies.length === 0) return baseEval;

  let bestReplyCp = baseEval.scoreCp;
  let replyMateIn: number | null = baseEval.mateIn;

  for (const r of replies) {
    // Check tactical moves: captures, checks, promotions
    if (!r.captured && !r.san.includes("+") && !r.san.includes("#") && !r.promotion) {
      continue;
    }

    chess.move(r);
    const ev = evaluateFenHeuristic(chess);
    chess.undo();

    if (sideToMove === "w") {
      if (ev.scoreCp > bestReplyCp) {
        bestReplyCp = ev.scoreCp;
        replyMateIn = ev.mateIn;
      }
    } else {
      if (ev.scoreCp < bestReplyCp) {
        bestReplyCp = ev.scoreCp;
        replyMateIn = ev.mateIn;
      }
    }
  }

  return { scoreCp: bestReplyCp, mateIn: replyMateIn };
}

/**
 * Fast evaluates a game with tactical 1-ply search to find real misses and best moves.
 */
export async function fastAnalyzeGame(
  gameRecord: GameRecord,
  userId?: string,
  options?: { skipRemoteSync?: boolean }
): Promise<{ positions: PositionRecord[]; reports: MoveAnalysisReport[] }> {
  const chess = new Chess(gameRecord.start_fen || undefined);
  const movesRaw = gameRecord.pgn ? gameRecord.pgn.trim() : "";

  // Parse moves from PGN
  try {
    chess.loadPgn(movesRaw, { strict: false });
  } catch {
    // fallback if loadPgn fails
  }

  const history = chess.history({ verbose: true });
  const playChess = new Chess(gameRecord.start_fen || undefined);

  const positionRecords: PositionRecord[] = [];
  const reports: MoveAnalysisReport[] = [];

  // Start position
  const startEval = evaluateFenHeuristic(playChess);
  const startWinProb = calculateWinProbability(startEval.scoreCp, startEval.mateIn);

  positionRecords.push({
    analysis_id: `fast-${gameRecord.id}`,
    game_id: gameRecord.id,
    user_id: userId || "local-user",
    ply: 0,
    fen: playChess.fen(),
    move_san: null,
    move_uci: null,
    score_cp: startEval.scoreCp,
    mate_in: startEval.mateIn,
    win_probability: startWinProb,
    best_move_uci: null,
    best_move_san: null,
    pv_lines: []
  });

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const beforeFen = playChess.fen();
    const sideToMove = playChess.turn();
    const mover: "white" | "black" = sideToMove === "w" ? "white" : "black";

    // Find best alternative move via 1-ply tactical scoring
    const legalMoves = playChess.moves({ verbose: true });
    let bestMove = legalMoves[0];
    let bestEvalCp = sideToMove === "w" ? -99999 : 99999;
    let bestMateIn: number | null = null;

    for (const m of legalMoves) {
      playChess.move(m);
      const ev = evaluateTacticalPosition(playChess);
      playChess.undo();

      if (sideToMove === "w") {
        if (ev.scoreCp > bestEvalCp) {
          bestEvalCp = ev.scoreCp;
          bestMateIn = ev.mateIn;
          bestMove = m;
        }
      } else {
        if (ev.scoreCp < bestEvalCp) {
          bestEvalCp = ev.scoreCp;
          bestMateIn = ev.mateIn;
          bestMove = m;
        }
      }
    }

    const bestUci = bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ""}` : "";
    const bestSan = bestMove?.san || "";

    // Candidate lines
    const candidateLines: CandidateLine[] = [
      {
        rank: 1,
        scoreCp: bestEvalCp,
        mateIn: bestMateIn,
        uci: bestUci,
        san: bestSan,
        pv: [bestUci],
        pvSan: bestSan
      }
    ];

    // Now execute actual played move
    playChess.move(move);
    const afterFen = playChess.fen();
    const afterEval = evaluateTacticalPosition(playChess);
    const afterWinProb = calculateWinProbability(afterEval.scoreCp, afterEval.mateIn);

    const prevPos = positionRecords[positionRecords.length - 1];
    prevPos.best_move_uci = bestUci;
    prevPos.best_move_san = bestSan;
    prevPos.pv_lines = candidateLines;

    const playedUci = `${move.from}${move.to}${move.promotion || ""}`;
    const playedSan = move.san;

    positionRecords.push({
      analysis_id: `fast-${gameRecord.id}`,
      game_id: gameRecord.id,
      user_id: userId || "local-user",
      ply: i + 1,
      fen: afterFen,
      move_san: playedSan,
      move_uci: playedUci,
      score_cp: afterEval.scoreCp,
      mate_in: afterEval.mateIn,
      win_probability: afterWinProb,
      best_move_uci: null,
      best_move_san: null,
      pv_lines: []
    });

    // Compute move loss from mover perspective
    const evalBefore = getMoverWinProbability(prevPos.win_probability, mover);
    const evalAfter = getMoverWinProbability(afterWinProb, mover);
    const loss = Math.max(0, Math.round((evalBefore - evalAfter) * 10) / 10);
    const isBestMove = bestUci === playedUci;
    const classification: MoveClassification = classifyMove(loss, isBestMove);

    // Tag mistakes
    let tags: string[] | undefined;
    if (classification === "mistake" || classification === "blunder") {
      const tagging = tagMistake({
        fenBefore: beforeFen,
        fenAfter: afterFen,
        playedUci,
        playedSan,
        bestUci,
        bestSan,
        pvLines: candidateLines,
        classification,
        winPctLoss: loss
      });
      tags = tagging.tags;
    }

    reports.push({
      ply: i + 1,
      mover,
      playedSan,
      playedUci,
      bestSan,
      bestUci,
      evalBefore,
      evalAfter,
      loss,
      classification,
      tags
    });
  }

  // Screening-only: save tagged mistakes locally for the weakness radar.
  // No game_analyses or positions are written (heuristic "best moves" are unreliable).
  // No TrainingExercises are generated — those require verified Stockfish analysis.
  if (gameRecord.user_colour !== "unknown") {
    const playerColour = gameRecord.user_colour;
    const screeningMistakes: MistakeRecord[] = reports
      .filter(r => r.mover === playerColour && (r.classification === "blunder" || r.classification === "mistake"))
      .map(r => ({
        id: crypto.randomUUID(),
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        game_id: gameRecord.id,
        position_id: null,
        ply: r.ply,
        fen: positionRecords[r.ply - 1]?.fen ?? "",
        played_san: r.playedSan,
        played_uci: r.playedUci,
        engine_class: r.classification as "blunder" | "mistake",
        win_pct_loss: r.loss,
        best_uci: r.bestUci || null,
        best_san: r.bestSan || null,
        tags: r.tags ?? [],
        tag_confidence: {},
        user_corrected: false
      }));

    if (screeningMistakes.length > 0) {
      saveScreeningMistakes(screeningMistakes);
    }
  }

  return { positions: positionRecords, reports };
}

/**
 * Screens multiple games with the heuristic scanner for weakness radar population.
 * Operates purely offline-first; no Supabase writes during the loop.
 */
export async function batchAnalyzeGames(
  games: GameRecord[],
  userId?: string,
  onProgress?: (analyzed: number, total: number) => void
): Promise<void> {
  // Skip games with unknown user colour — can't distinguish player mistakes from opponent's
  const knownColourGames = games.filter(g => g.user_colour === "white" || g.user_colour === "black");

  for (let i = 0; i < knownColourGames.length; i++) {
    await fastAnalyzeGame(knownColourGames[i], userId);
    if (onProgress) {
      // Report progress against the full games array so the UI count is consistent
      const overallIdx = games.indexOf(knownColourGames[i]);
      onProgress(overallIdx + 1, games.length);
    }
    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 5));
  }

  // Report skipped games to reach 100%
  if (onProgress) {
    onProgress(games.length, games.length);
  }

  // After local screening is complete, sync any verified mistakes from full Stockfish
  // analyses to Supabase in the background (does not block the caller).
  if (userId) {
    syncLocalTrainingToSupabase(userId).catch(err => {
      console.warn("Background training sync deferred:", err);
    });
  }
}
