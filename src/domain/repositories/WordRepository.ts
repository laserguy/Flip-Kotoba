import type { Word, WordInput } from '../entities/Word';

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
  getDue(deckId: number, now: Date): Promise<Word[]>;
  updateReviewState(id: number, state: ReviewState): Promise<Word>;
  moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Word>;
  revertFromMemorized(id: number, originDeckId: number): Promise<Word>;
}
