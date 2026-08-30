import { BOX_INTERVAL_DAYS, MAX_BOX_LEVEL, MEMORIZE_STREAK_THRESHOLD, MIN_BOX_LEVEL } from './constants';

export function dueDateForBoxLevel(boxLevel: number, from: Date = new Date()): Date {
  const days = BOX_INTERVAL_DAYS[boxLevel] ?? 0;
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return due;
}

export interface ReviewScheduleStep {
  boxLevel: number;
  intervalDays: number;
}

// The Leitner-style review ladder, read straight from BOX_INTERVAL_DAYS so the
// UI explains the schedule with the exact numbers applySwipe/dueDateForBoxLevel
// use. A word sits at a box level; intervalDays is how long until it's shown
// again. A right swipe promotes it one level (longer wait); a left swipe drops
// it to MIN_BOX_LEVEL, due again the same day.
export function reviewScheduleSteps(): ReviewScheduleStep[] {
  return Object.keys(BOX_INTERVAL_DAYS)
    .map(Number)
    .sort((lower, higher) => lower - higher)
    .map((boxLevel) => ({ boxLevel, intervalDays: BOX_INTERVAL_DAYS[boxLevel] }));
}

export type SwipeOutcome = {
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  readyToMemorize: boolean;
};

export function applySwipe(
  current: { boxLevel: number; rightStreak: number },
  direction: 'right' | 'left',
  now: Date = new Date(),
): SwipeOutcome {
  if (direction === 'left') {
    return {
      boxLevel: MIN_BOX_LEVEL,
      rightStreak: 0,
      nextDueAt: dueDateForBoxLevel(MIN_BOX_LEVEL, now),
      readyToMemorize: false,
    };
  }

  const boxLevel = Math.min(current.boxLevel + 1, MAX_BOX_LEVEL);
  const rightStreak = Math.min(current.rightStreak + 1, MEMORIZE_STREAK_THRESHOLD);
  return {
    boxLevel,
    rightStreak,
    nextDueAt: dueDateForBoxLevel(boxLevel, now),
    readyToMemorize: rightStreak >= MEMORIZE_STREAK_THRESHOLD,
  };
}
