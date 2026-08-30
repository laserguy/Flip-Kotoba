export const DECK_NAME_MAX_LENGTH = 20;
export const MEMORIZED_DECK_NAME = 'Memorized';
export const MEMORIZED_KANJI_DECK_NAME = 'Memorized Kanji';

export const MIN_BOX_LEVEL = 1;
export const MAX_BOX_LEVEL = 5;
export const MEMORIZE_STREAK_THRESHOLD = 10;

// Days to wait before a word at this box level is due again.
export const BOX_INTERVAL_DAYS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 14,
};
