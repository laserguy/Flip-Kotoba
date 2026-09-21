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

  it('rejects a case-insensitive duplicate name within the same content type', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    await createDeck({ name: 'JLPT N5' });
    await expect(createDeck({ name: '  jlpt n5  ' })).rejects.toThrow('Deck name "jlpt n5" already exists.');
  });

  it('allows the same name across different content types', async () => {
    const { createDeck } = createDeckUseCases(createFakeDeckRepository());
    await createDeck({ name: 'JLPT N5', content: 'words' });
    const kanjiDeck = await createDeck({ name: 'JLPT N5', content: 'kanji' });
    expect(kanjiDeck.content).toBe('kanji');
  });
});

describe('deckUseCases.getDeck', () => {
  it('returns the persisted deck', async () => {
    const { createDeck, getDeck } = createDeckUseCases(createFakeDeckRepository());
    const created = await createDeck({ name: 'Verbs' });
    const found = await getDeck(created.id);
    expect(found?.name).toBe('Verbs');
  });

  it('returns null for an unknown id', async () => {
    const { getDeck } = createDeckUseCases(createFakeDeckRepository());
    expect(await getDeck(999)).toBeNull();
  });
});

describe('deckUseCases.updateDeck', () => {
  it('renames a deck and persists the change', async () => {
    const repo = createFakeDeckRepository();
    const { createDeck, updateDeck } = createDeckUseCases(repo);
    const deck = await createDeck({ name: 'Old Name' });

    const updated = await updateDeck(deck.id, { name: 'New Name' });

    expect(updated.name).toBe('New Name');
    expect((await repo.findById(deck.id))?.name).toBe('New Name');
  });

  it('allows renaming a deck to its own current name', async () => {
    const { createDeck, updateDeck } = createDeckUseCases(createFakeDeckRepository());
    const deck = await createDeck({ name: 'Verbs' });

    await expect(updateDeck(deck.id, { name: '  Verbs  ' })).resolves.toMatchObject({ name: 'Verbs' });
  });

  it('rejects renaming to a name already used by another deck of the same content type', async () => {
    const { createDeck, updateDeck } = createDeckUseCases(createFakeDeckRepository());
    await createDeck({ name: 'Nouns' });
    const other = await createDeck({ name: 'Verbs' });

    await expect(updateDeck(other.id, { name: 'nouns' })).rejects.toThrow('Deck name "nouns" already exists.');
  });

  it('rejects an empty or too-long name on rename', async () => {
    const { createDeck, updateDeck } = createDeckUseCases(createFakeDeckRepository());
    const deck = await createDeck({ name: 'Verbs' });

    await expect(updateDeck(deck.id, { name: '   ' })).rejects.toThrow('Deck name is required.');
  });

  it('throws for an unknown deck id', async () => {
    const { updateDeck } = createDeckUseCases(createFakeDeckRepository());
    await expect(updateDeck(999, { name: 'Anything' })).rejects.toThrow('Deck not found.');
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
