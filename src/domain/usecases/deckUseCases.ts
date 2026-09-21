import type { DeckContent } from '../entities/Deck';
import type { DeckRepository } from '../repositories/DeckRepository';
import { DECK_NAME_MAX_LENGTH } from '../constants';

function validateName(rawName: string): string {
  const name = rawName.trim();
  if (!name) throw new Error('Deck name is required.');
  if (name.length > DECK_NAME_MAX_LENGTH) {
    throw new Error(`Deck name must be ${DECK_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return name;
}

export function createDeckUseCases(deckRepository: DeckRepository) {
  async function assertNameAvailable(name: string, content: DeckContent, excludeId?: number): Promise<void> {
    const existing = await deckRepository.findByName(name, content);
    if (existing && existing.id !== excludeId) {
      throw new Error(`Deck name "${name}" already exists.`);
    }
  }

  return {
    createDeck: async (input: { name: string; description?: string | null; content?: DeckContent }) => {
      const name = validateName(input.name);
      const content = input.content ?? 'words';
      await assertNameAvailable(name, content);
      return deckRepository.create({
        name,
        description: input.description?.trim() || null,
        content,
      });
    },

    getDeck: (id: number) => deckRepository.findById(id),

    updateDeck: async (id: number, input: { name: string; description?: string | null }) => {
      const deck = await deckRepository.findById(id);
      if (!deck) throw new Error('Deck not found.');

      const name = validateName(input.name);
      await assertNameAvailable(name, deck.content, id);
      return deckRepository.update(id, {
        name,
        description: input.description?.trim() || null,
      });
    },

    deleteDeck: (id: number) => deckRepository.delete(id),
  };
}

export type DeckUseCases = ReturnType<typeof createDeckUseCases>;
