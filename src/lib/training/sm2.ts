/**
 * sm2.ts — Modified SM-2 Spaced Repetition scheduler.
 *
 * Implements Section 3.8:
 * - State: repetitions, ease_factor (default 2.5, min 1.3), interval_days, due_at, lapses.
 * - Grades: Again, Hard, Good, Easy.
 * - Cap interval at 60 days.
 * - 5 or more consecutive Good or Easy results mark the exercise Mastered.
 */

import type { ExerciseGrade, ReviewScheduleRecord, ExerciseStatus } from "./types";

export interface SM2State {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
  consecutiveSuccesses: number;
}

export interface SM2Result {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueAt: Date;
  lapses: number;
  consecutiveSuccesses: number;
  isMastered: boolean;
}

export const SM2_DEFAULTS = {
  INITIAL_EASE: 2.5,
  MIN_EASE: 1.3,
  MAX_INTERVAL_DAYS: 60,
  MASTERY_CONSECUTIVE_SUCCESSES: 5,
  AGAIN_INTERVAL_MINUTES: 10
} as const;

/**
 * Calculates next review schedule and mastery status based on an attempt grade.
 */
export function calculateNextReview(
  currentState: {
    repetitions?: number;
    easeFactor?: number;
    intervalDays?: number;
    lapses?: number;
    consecutiveSuccesses?: number;
  },
  grade: ExerciseGrade,
  now: Date = new Date()
): SM2Result {
  let rep = currentState.repetitions ?? 0;
  let ease = currentState.easeFactor ?? SM2_DEFAULTS.INITIAL_EASE;
  let interval = currentState.intervalDays ?? 1;
  let lapses = currentState.lapses ?? 0;
  let consec = currentState.consecutiveSuccesses ?? 0;

  let nextDue: Date;

  switch (grade) {
    case "Again": {
      rep = 0;
      lapses += 1;
      consec = 0;
      ease = Math.max(SM2_DEFAULTS.MIN_EASE, Math.round((ease - 0.20) * 100) / 100);
      interval = 0.007; // ~10 minutes represented in days (10 / (24 * 60))
      nextDue = new Date(now.getTime() + SM2_DEFAULTS.AGAIN_INTERVAL_MINUTES * 60 * 1000);
      break;
    }

    case "Hard": {
      consec = 0;
      ease = Math.max(SM2_DEFAULTS.MIN_EASE, Math.round((ease - 0.15) * 100) / 100);
      interval = Math.max(1, Math.round(interval * 1.2 * 10) / 10);
      if (interval > SM2_DEFAULTS.MAX_INTERVAL_DAYS) {
        interval = SM2_DEFAULTS.MAX_INTERVAL_DAYS;
      }
      nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      break;
    }

    case "Good": {
      rep += 1;
      consec += 1;
      if (rep === 1) {
        interval = 1;
      } else if (rep === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * ease);
      }
      if (interval > SM2_DEFAULTS.MAX_INTERVAL_DAYS) {
        interval = SM2_DEFAULTS.MAX_INTERVAL_DAYS;
      }
      nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      break;
    }

    case "Easy": {
      rep += 1;
      consec += 1;
      ease = Math.round((ease + 0.15) * 100) / 100;
      if (rep === 1) {
        interval = 1;
      } else if (rep === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * ease);
      }
      interval = Math.round(interval * 1.3);
      if (interval > SM2_DEFAULTS.MAX_INTERVAL_DAYS) {
        interval = SM2_DEFAULTS.MAX_INTERVAL_DAYS;
      }
      nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      break;
    }
  }

  const isMastered = consec >= SM2_DEFAULTS.MASTERY_CONSECUTIVE_SUCCESSES;

  return {
    repetitions: rep,
    easeFactor: ease,
    intervalDays: interval,
    dueAt: nextDue,
    lapses,
    consecutiveSuccesses: consec,
    isMastered
  };
}

/**
 * Infers an initial grade from attempt metrics (duration, hints, correctness).
 */
export function inferGrade(attempt: {
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  medianDurationMs?: number;
}): ExerciseGrade {
  if (!attempt.correct) {
    return "Again";
  }

  const median = attempt.medianDurationMs || 15000;

  if (attempt.hintsUsed > 0 || attempt.durationMs > median * 2) {
    return "Hard";
  }

  if (attempt.hintsUsed === 0 && attempt.durationMs < median * 0.6) {
    return "Easy";
  }

  return "Good";
}
