import type { Kanji, KanjiInput } from '../entities/Kanji';
import type { ReviewState } from './WordRepository';

// Kanji share the word SRS model, so the review-state shape is reused as-is.
export interface KanjiRepository {
  create(input: KanjiInput): Promise<Kanji>;
  delete(id: number): Promise<void>;
  findById(id: number): Promise<Kanji | null>;
  getDue(deckId: number, now: Date): Promise<Kanji[]>;
  updateReviewState(id: number, state: ReviewState): Promise<Kanji>;
  moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Kanji>;
  revertFromMemorized(id: number, originDeckId: number): Promise<Kanji>;
}
