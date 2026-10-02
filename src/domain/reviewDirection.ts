import type { ReviewDirection } from './entities/Word';

export type DueCounts = Record<ReviewDirection, number>;

export function otherDirection(direction: ReviewDirection): ReviewDirection {
  return direction === 'jpToEn' ? 'enToJp' : 'jpToEn';
}

export type EmptyQueueGuidance =
  | { kind: 'switchDirection'; direction: ReviewDirection; dueCount: number }
  | { kind: 'allCaughtUp' };

// What to tell the user once the current direction's review queue runs dry.
// The two directions are scheduled independently, so finishing one says
// nothing about the other — without this, "All caught up" reads as "done for
// the day" even while the other direction still has words waiting.
export function guidanceForEmptyQueue(current: ReviewDirection, dueCounts: DueCounts): EmptyQueueGuidance {
  const other = otherDirection(current);
  const dueCount = dueCounts[other];
  return dueCount > 0 ? { kind: 'switchDirection', direction: other, dueCount } : { kind: 'allCaughtUp' };
}
