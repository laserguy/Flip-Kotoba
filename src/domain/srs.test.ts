import { applySwipe, dueDateForBoxLevel, reviewScheduleSteps } from './srs';
import { MAX_BOX_LEVEL, MIN_BOX_LEVEL } from './constants';

describe('dueDateForBoxLevel', () => {
  it('maps each box level to the correct interval in days', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(dueDateForBoxLevel(1, from)).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(dueDateForBoxLevel(2, from)).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(dueDateForBoxLevel(3, from)).toEqual(new Date('2026-01-04T00:00:00.000Z'));
    expect(dueDateForBoxLevel(4, from)).toEqual(new Date('2026-01-08T00:00:00.000Z'));
    expect(dueDateForBoxLevel(5, from)).toEqual(new Date('2026-01-15T00:00:00.000Z'));
  });
});

describe('reviewScheduleSteps', () => {
  it('lists every box level from lowest to highest', () => {
    const levels = reviewScheduleSteps().map((step) => step.boxLevel);
    expect(levels[0]).toBe(MIN_BOX_LEVEL);
    expect(levels[levels.length - 1]).toBe(MAX_BOX_LEVEL);
    expect(levels).toEqual([...levels].sort((lower, higher) => lower - higher));
  });

  it('shows a freshly missed word again the same day', () => {
    expect(reviewScheduleSteps()[0]).toEqual({ boxLevel: MIN_BOX_LEVEL, intervalDays: 0 });
  });

  it('never shortens the wait as a word is promoted', () => {
    const intervals = reviewScheduleSteps().map((step) => step.intervalDays);
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it('matches the intervals dueDateForBoxLevel actually applies', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    for (const { boxLevel, intervalDays } of reviewScheduleSteps()) {
      const expected = new Date(from);
      expected.setDate(expected.getDate() + intervalDays);
      expect(dueDateForBoxLevel(boxLevel, from)).toEqual(expected);
    }
  });
});

describe('applySwipe', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('advances the box level on a right swipe, capped at 5', () => {
    expect(applySwipe({ boxLevel: 1, rightStreak: 0 }, 'right', now).boxLevel).toBe(2);
    expect(applySwipe({ boxLevel: 5, rightStreak: 0 }, 'right', now).boxLevel).toBe(5);
  });

  it('increments the right streak, capped at the memorize threshold', () => {
    expect(applySwipe({ boxLevel: 1, rightStreak: 0 }, 'right', now).rightStreak).toBe(1);
    expect(applySwipe({ boxLevel: 1, rightStreak: 9 }, 'right', now).rightStreak).toBe(10);
    expect(applySwipe({ boxLevel: 1, rightStreak: 10 }, 'right', now).rightStreak).toBe(10);
  });

  it('only signals readyToMemorize once the streak reaches 10', () => {
    expect(applySwipe({ boxLevel: 1, rightStreak: 8 }, 'right', now).readyToMemorize).toBe(false);
    expect(applySwipe({ boxLevel: 1, rightStreak: 9 }, 'right', now).readyToMemorize).toBe(true);
  });

  it('resets box level and streak to zero on a left swipe, regardless of prior progress', () => {
    const outcome = applySwipe({ boxLevel: 5, rightStreak: 9 }, 'left', now);
    expect(outcome.boxLevel).toBe(1);
    expect(outcome.rightStreak).toBe(0);
    expect(outcome.readyToMemorize).toBe(false);
    expect(outcome.nextDueAt).toEqual(now);
  });
});
