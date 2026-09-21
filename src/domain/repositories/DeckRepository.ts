import type { Deck, DeckContent } from '../entities/Deck';

export interface DeckRepository {
  create(input: { name: string; description: string | null; content: DeckContent }): Promise<Deck>;
  update(id: number, input: { name: string; description: string | null }): Promise<Deck>;
  delete(id: number): Promise<void>;
  findById(id: number): Promise<Deck | null>;
  // Case-insensitive lookup scoped to content type, used to reject duplicate deck names.
  findByName(name: string, content: DeckContent): Promise<Deck | null>;
  // There is one memorized deck per content type (one for words, one for kanji).
  getMemorized(content: DeckContent): Promise<Deck | null>;
  getOrCreateMemorized(content: DeckContent): Promise<Deck>;
}
