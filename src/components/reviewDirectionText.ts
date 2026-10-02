import type { ReviewDirection } from '../domain/entities/Word';
import type { EmptyQueueGuidance } from '../domain/reviewDirection';

export const DIRECTION_LABELS: Record<ReviewDirection, string> = {
  jpToEn: 'JP → EN',
  enToJp: 'EN → JP',
};

function wordCount(count: number): string {
  return `${count} word${count === 1 ? '' : 's'}`;
}

export function emptyQueueText(current: ReviewDirection, guidance: EmptyQueueGuidance): string {
  if (guidance.kind === 'allCaughtUp') return 'All caught up in both directions!';
  return `All caught up on ${DIRECTION_LABELS[current]}. ${wordCount(guidance.dueCount)} still due in ${
    DIRECTION_LABELS[guidance.direction]
  }.`;
}

export function switchDirectionLabel(direction: ReviewDirection): string {
  return `Review ${DIRECTION_LABELS[direction]}`;
}

export function directionToggleLabel(direction: ReviewDirection, dueCount: number | undefined): string {
  return dueCount === undefined ? DIRECTION_LABELS[direction] : `${DIRECTION_LABELS[direction]} (${dueCount})`;
}
