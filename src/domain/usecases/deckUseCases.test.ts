import { createDeckUseCases } from './deckUseCases';
import { createFakeDeckRepository } from '../testing/fakes';
import { DECK_NAME_MAX_LENGTH } from '../constants';

describe('deckUseCases.createDeck', () => {
  it('creates a normal word deck with a trimmed name by default', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    const deck = await createDeck({ name: '  JLPT N5  ', description: undefined });
    expect(deck.name).toBe('JLPT N5');
    expect(deck.kind).toBe('normal');
    expect(deck.content).toBe('words');
  });

  it('creates a kanji deck when content is "kanji"', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    const deck = await createDeck({ name: 'Kanji N5', content: 'kanji' });
    expect(deck.content).toBe('kanji');
  });

  it('stores a trimmed description, or null when omitted/blank', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    const withDescription = await createDeck({ name: 'Verbs', description: '  common verbs  ' });
    expect(withDescription.description).toBe('common verbs');

    const withoutDescription = await createDeck({ name: 'Nouns', description: '   ' });
    expect(withoutDescription.description).toBeNull();
  });

  it('rejects an empty or whitespace-only name', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    await expect(createDeck({ name: '   ' })).rejects.toThrow('Deck name is required.');
  });

  it(`rejects a name longer than ${DECK_NAME_MAX_LENGTH} characters`, async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    const tooLong = 'x'.repeat(DECK_NAME_MAX_LENGTH + 1);
    await expect(createDeck({ name: tooLong })).rejects.toThrow(/20 characters or fewer/);
  });
});

describe('deckUseCases.deleteDeck', () => {
  it('removes the deck from the repository', async () => {
    const repo = createFakeDeckRepository();
    const { createDeck, deleteDeck } = createDeckUseCases(repo);
    const deck = await createDeck({ name: 'Temporary' });

    await deleteDeck(deck.id);

    expect(await repo.findById(deck.id)).toBeNull();
  });
});
