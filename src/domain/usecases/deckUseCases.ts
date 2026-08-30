import type { DeckContent } from '../entities/Deck';
import type { DeckRepository } from '../repositories/DeckRepository';
import { DECK_NAME_MAX_LENGTH } from '../constants';

export function createDeckUseCases(deckRepository: DeckRepository) {
  return {
    createDeck: async (input: { name: string; description?: string | null; content?: DeckContent }) => {
      const name = input.name.trim();
      if (!name) throw new Error('Deck name is required.');
      if (name.length > DECK_NAME_MAX_LENGTH) {
        throw new Error(`Deck name must be ${DECK_NAME_MAX_LENGTH} characters or fewer.`);
      }
      return deckRepository.create({
        name,
        description: input.description?.trim() || null,
        content: input.content ?? 'words',
      });
    },

    deleteDeck: (id: number) => deckRepository.delete(id),
  };
}

export type DeckUseCases = ReturnType<typeof createDeckUseCases>;
