/**
 * types.ts — Training, Mistakes, and Spaced Repetition type definitions.
 *
 * Implements data structures for Section 3.7 (Eligibility), Section 3.8 (SM-2 Spaced Repetition),
 * and Section 3.9 (Data model).
 */

export type MistakeClass = "inaccuracy" | "mistake" | "blunder";

export interface MistakeRecord {
  id: string;
  user_id: string;
  game_id: string;
  position_id?: string | null;
  ply: number;
  fen: string;
  played_san: string;
  played_uci: string;
  engine_class: MistakeClass;
  win_pct_loss: number;
  best_uci?: string | null;
  best_san?: string | null;
  tags: string[];
  tag_confidence?: Record<string, number>;
  user_corrected: boolean;
  note?: string | null;
  created_at?: string;
}

export type ExerciseType = "attack" | "defence" | "avoid_blunder";
export type ExerciseStatus = "active" | "mastered" | "flagged";
export type ExerciseDifficulty = "easy" | "medium" | "hard";

export interface SolutionMove {
  san: string;
  uci: string;
  winProb?: number;
  scoreCp?: number | null;
  mateIn?: number | null;
}

export interface TrainingExerciseRecord {
  id: string;
  user_id: string;
  mistake_id?: string | null;
  game_id?: string | null;
  fen: string;
  user_colour: "white" | "black";
  exercise_type: ExerciseType;
  prompt: string;
  solutions: SolutionMove[];
  principal_variation?: string[];
  blunder_move?: { san: string; uci: string } | null;
  themes: string[];
  difficulty: ExerciseDifficulty;
  status: ExerciseStatus;
  flag_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ExerciseGrade = "Again" | "Hard" | "Good" | "Easy";

export interface ReviewScheduleRecord {
  exercise_id: string;
  user_id: string;
  due_at: string; // ISO 8601
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  lapses: number;
  last_reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExerciseAttemptRecord {
  id?: string;
  exercise_id: string;
  user_id: string;
  attempted_at?: string;
  correct: boolean;
  duration_ms: number;
  hints_used: number;
  moves_tried: string[];
  grade: ExerciseGrade;
}

export interface TrainingSessionRecord {
  id?: string;
  user_id: string;
  started_at?: string;
  ended_at?: string | null;
  exercises_done: number;
  exercises_correct: number;
  created_at?: string;
}

export interface ExerciseWithSchedule extends TrainingExerciseRecord {
  schedule?: ReviewScheduleRecord;
}

