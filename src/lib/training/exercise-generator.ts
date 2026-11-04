/**
 * exercise-generator.ts — Generates training exercises from game analysis.
 *
 * Implements Section 3.7:
 * 1. Mover is the user and classification is Mistake or Blunder.
 * 2. Position before the move is not already decided: mover win% is between 10% and 90%.
 * 3. Clear task exists:
 *    - Single solution: best beats second-best by >= 10 win points.
 *    - Multi-solution: all candidate moves within 3 win points of best.
 * 4. Maximum 3 exercises per game, sorted by largest loss.
 * 5. Deduplication against existing exercise FENs.
 */

import { Chess } from "chess.js";
import type { GameRecord } from "../games";
import type { PositionRecord, MoveAnalysisReport, CandidateLine } from "../engine/types";
import type {
  TrainingExerciseRecord,
  MistakeRecord,
  SolutionMove,
  ExerciseType,
  ExerciseDifficulty
} from "./types";
import { getMoverWinProbability, calculateWinProbability } from "../engine/win-probability";
import { tagMistake } from "../insight/mistake-tagger";

export interface ExerciseGenerationInput {
  game: GameRecord;
  positions: PositionRecord[];
  reports: MoveAnalysisReport[];
  existingFens?: Set<string>;
  userColour?: "white" | "black";
}

export interface GeneratedExerciseSet {
  mistakes: MistakeRecord[];
  exercises: TrainingExerciseRecord[];
}

/**
 * Determine exercise type based on position dynamics:
 * - 'defence': when position was under pressure (< 45% win prob)
 * - 'attack': when position was winning or had sharp tactical punch (>= 60% win prob)
 * - 'avoid_blunder': default practical tactical challenge (45% - 60% win prob)
 */
function determineExerciseType(
  evalBefore: number,
  loss: number
): ExerciseType {
  if (evalBefore < 45) return "defence";
  if (evalBefore >= 60) return "attack";
  return "avoid_blunder";
}

/**
 * Build descriptive prompt for the player depending on exercise type.
 */
function buildPrompt(type: ExerciseType, userColour: "white" | "black"): string {
  const side = userColour === "white" ? "White" : "Black";
  switch (type) {
    case "attack":
      return `${side} has a winning tactical opportunity. Find the best continuation.`;
    case "defence":
      return `${side} is under pressure. Find the resilient defensive move to hold.`;
    case "avoid_blunder":
      return `${side} to move. Find a solid move and avoid the mistake made in the game.`;
  }
}

/**
 * Filter and generate exercises from a game analysis according to Section 3.7.
 */
export function generateExercisesFromGame({
  game,
  positions,
  reports,
  existingFens = new Set<string>(),
  userColour
}: ExerciseGenerationInput): GeneratedExerciseSet {
  const playerColour: "white" | "black" =
    userColour ||
    (game.user_colour === "white" || game.user_colour === "black"
      ? game.user_colour
      : "white");

  const eligibleCandidates: Array<{
    report: MoveAnalysisReport;
    posBefore: PositionRecord;
    posAfter: PositionRecord;
    solutions: SolutionMove[];
    pv: string[];
  }> = [];

  const allMistakes: MistakeRecord[] = [];

  for (const report of reports) {
    // Rule 1: Only collect and train on the user's own moves
    if (report.mover !== playerColour) continue;

    // Collect user mistakes for the database record
    if (
      report.classification === "mistake" ||
      report.classification === "blunder" ||
      report.classification === "inaccuracy"
    ) {
      const posBefore = positions.find(p => p.ply === report.ply - 1);
      const posAfter = positions.find(p => p.ply === report.ply);

      if (posBefore && posAfter) {
        const tagging = tagMistake({
          fenBefore: posBefore.fen,
          fenAfter: posAfter.fen,
          playedUci: report.playedUci,
          playedSan: report.playedSan,
          bestUci: report.bestUci,
          bestSan: report.bestSan,
          pvLines: posBefore.pv_lines as CandidateLine[],
          classification: report.classification,
          winPctLoss: report.loss
        });

        allMistakes.push({
          id: `mistake-${game.id}-${report.ply}`,
          user_id: game.user_id || "00000000-0000-0000-0000-000000000000",
          game_id: game.id,
          position_id: posAfter.id,
          ply: report.ply,
          fen: posBefore.fen,
          played_san: report.playedSan,
          played_uci: report.playedUci,
          engine_class: report.classification,
          win_pct_loss: report.loss,
          best_uci: report.bestUci,
          best_san: report.bestSan,
          tags: tagging.tags,
          tag_confidence: tagging.confidence,
          user_corrected: false
        });
      }
    }

    // Only mistakes and blunders become candidate exercises
    if (report.classification !== "mistake" && report.classification !== "blunder") continue;

    const posBefore = positions.find(p => p.ply === report.ply - 1);
    const posAfter = positions.find(p => p.ply === report.ply);
    if (!posBefore || !posAfter) continue;

    // Rule 3: Position not already decided (win prob between 10% and 90%)
    const moverProbBefore = report.evalBefore;
    if (moverProbBefore < 10 || moverProbBefore > 90) continue;

    // Rule 6: Position (by FEN) not already an existing exercise
    if (existingFens.has(posBefore.fen)) continue;

    // Rule 4: Clear task exists
    const pvLines = (posBefore.pv_lines || []) as CandidateLine[];
    const solutions: SolutionMove[] = [];

    if (pvLines.length > 0) {
      const best = pvLines[0];
      const bestProb = getMoverWinProbability(
        calculateWinProbability(best.scoreCp ?? null, best.mateIn ?? null),
        playerColour
      );

      solutions.push({
        san: best.san || "",
        uci: best.uci || "",
        winProb: bestProb,
        scoreCp: best.scoreCp,
        mateIn: best.mateIn
      });

      if (pvLines.length > 1) {
        const second = pvLines[1];
        const secondProb = getMoverWinProbability(
          calculateWinProbability(second.scoreCp ?? null, second.mateIn ?? null),
          playerColour
        );

        const diff = bestProb - secondProb;

        // If second best is within 3 points, include it as alternative solution (multi-solution)
        for (let i = 1; i < pvLines.length; i++) {
          const cand = pvLines[i];
          const candProb = getMoverWinProbability(
            calculateWinProbability(cand.scoreCp ?? null, cand.mateIn ?? null),
            playerColour
          );
          if (bestProb - candProb <= 3) {
            solutions.push({
              san: cand.san || "",
              uci: cand.uci || "",
              winProb: candProb,
              scoreCp: cand.scoreCp,
              mateIn: cand.mateIn
            });
          }
        }

        // Section 3.7: Must either be single solution (diff >= 10) or multi-solution
        if (solutions.length === 1 && diff < 10) {
          // Ambiguous single candidate line that doesn't strongly beat #2 (diff < 10 points)
          continue;
        }
      }
    } else if (posBefore.best_move_san && posBefore.best_move_uci) {
      solutions.push({
        san: posBefore.best_move_san,
        uci: posBefore.best_move_uci
      });
    }

    if (solutions.length === 0 || !solutions[0].san) continue;

    eligibleCandidates.push({
      report,
      posBefore,
      posAfter,
      solutions,
      pv: pvLines[0]?.pv || [solutions[0].uci]
    });
  }

  // Rule 7: At most 3 exercises per game, chosen by largest loss
  eligibleCandidates.sort((a, b) => b.report.loss - a.report.loss);
  const selected = eligibleCandidates.slice(0, 3);

  const exercises: TrainingExerciseRecord[] = selected.map((item, index) => {
    const exerciseType = determineExerciseType(item.report.evalBefore, item.report.loss);
    const difficulty: ExerciseDifficulty =
      item.report.loss > 20 ? "easy" : item.report.loss > 10 ? "medium" : "hard";

    return {
      id: `ex-${game.id}-${item.report.ply}`,
      user_id: game.user_id || "00000000-0000-0000-0000-000000000000",
      game_id: game.id,
      mistake_id: `mistake-${game.id}-${item.report.ply}`,
      fen: item.posBefore.fen,
      user_colour: playerColour,
      exercise_type: exerciseType,
      prompt: buildPrompt(exerciseType, playerColour),
      solutions: item.solutions,
      principal_variation: item.pv,
      blunder_move: {
        san: item.report.playedSan,
        uci: item.report.playedUci
      },
      themes: [item.report.classification],
      difficulty,
      status: "active"
    };
  });

  return {
    mistakes: allMistakes,
    exercises
  };
}

