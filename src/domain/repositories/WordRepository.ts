import type { ReviewDirection, Word, WordInput } from '../entities/Word';

export interface ReviewState {
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date;
}

export interface WordRepository {
  create(input: WordInput): Promise<Word>;
  update(id: number, input: WordInput): Promise<Word>;
  delete(id: number): Promise<void>;
  findById(id: number): Promise<Word | null>;
  // Due in the given direction: its nextDueAt has passed, and it isn't paused
  // waiting on the other direction to catch up (see recordSwipe in
  // wordUseCases.ts for the pause rule).
  getDue(deckId: number, direction: ReviewDirection, now: Date): Promise<Word[]>;
  updateReviewState(id: number, direction: ReviewDirection, state: ReviewState): Promise<Word>;
  moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Word>;
  revertFromMemorized(id: number, originDeckId: number): Promise<Word>;
}
