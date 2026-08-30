import { createWordUseCases } from './wordUseCases';
import { createFakeDeckRepository, createFakeWordRepository } from '../testing/fakes';

function setup() {
  const deckRepository = createFakeDeckRepository();
  const wordRepository = createFakeWordRepository();
  return { ...createWordUseCases(wordRepository, deckRepository), wordRepository, deckRepository };
}

describe('wordUseCases.createWord / updateWord', () => {
  it('trims fields and stores blank optional fields as null', async () => {
    const { createWord } = setup();
    const word = await createWord({
      deckId: 1,
      kanji: '  ',
      furigana: '  たべる  ',
      englishMeaning: '  to eat  ',
    });
    expect(word.kanji).toBeNull();
    expect(word.furigana).toBe('たべる');
    expect(word.englishMeaning).toBe('to eat');
  });

  it('rejects a Japanese example sentence with no English translation', async () => {
    const { createWord } = setup();
    await expect(
      createWord({
        deckId: 1,
        furigana: 'たべる',
        englishMeaning: 'to eat',
        exampleSentenceJp: '朝ごはんを食べる。',
      }),
    ).rejects.toThrow('An English translation is required');
  });

  it('accepts a sentence when its translation is also given', async () => {
    const { createWord } = setup();
    const word = await createWord({
      deckId: 1,
      furigana: 'たべる',
      englishMeaning: 'to eat',
      exampleSentenceJp: '朝ごはんを食べる。',
      exampleSentenceEn: 'I eat breakfast.',
    });
    expect(word.exampleSentenceEn).toBe('I eat breakfast.');
  });

  it('applies the same validation on update', async () => {
    const { createWord, updateWord } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });
    await expect(
      updateWord(word.id, { deckId: 1, furigana: 'たべる', englishMeaning: 'to eat', exampleSentenceJp: '文' }),
    ).rejects.toThrow('An English translation is required');
  });
});

describe('wordUseCases.recordSwipe', () => {
  it('advances box level and streak on a right swipe, not yet ready to memorize', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    const { word: updated, readyToMemorize } = await recordSwipe(word.id, 'right', new Date('2026-01-01'));

    expect(updated.boxLevel).toBe(2);
    expect(updated.rightStreak).toBe(1);
    expect(readyToMemorize).toBe(false);
  });

  it('signals readyToMemorize on the 10th consecutive right swipe', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    let result;
    for (let i = 0; i < 10; i++) {
      result = await recordSwipe(word.id, 'right', new Date('2026-01-01'));
    }

    expect(result!.readyToMemorize).toBe(true);
    expect(result!.word.rightStreak).toBe(10);
  });

  it('resets progress on a left swipe even after a long streak', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    for (let i = 0; i < 5; i++) await recordSwipe(word.id, 'right', new Date('2026-01-01'));
    const { word: updated, readyToMemorize } = await recordSwipe(word.id, 'left', new Date('2026-01-01'));

    expect(updated.boxLevel).toBe(1);
    expect(updated.rightStreak).toBe(0);
    expect(readyToMemorize).toBe(false);
  });

  it('throws when the word does not exist', async () => {
    const { recordSwipe } = setup();
    await expect(recordSwipe(999, 'right')).rejects.toThrow('Word 999 not found');
  });
});

describe('wordUseCases.moveToMemorized / revertFromMemorized', () => {
  it('moves a word into a lazily-created memorized deck, remembering its origin', async () => {
    const { createWord, moveToMemorized, deckRepository } = setup();
    const word = await createWord({ deckId: 42, furigana: 'たべる', englishMeaning: 'to eat' });

    const moved = await moveToMemorized(word.id);
    const memorizedDeck = await deckRepository.getMemorized('words');

    expect(memorizedDeck).not.toBeNull();
    expect(moved.deckId).toBe(memorizedDeck!.id);
    expect(moved.originDeckId).toBe(42);
  });

  it('reverts a memorized word back to its origin deck and resets its review state', async () => {
    const { createWord, moveToMemorized, revertFromMemorized } = setup();
    const word = await createWord({ deckId: 42, furigana: 'たべる', englishMeaning: 'to eat' });
    await moveToMemorized(word.id);

    const reverted = await revertFromMemorized(word.id);

    expect(reverted.deckId).toBe(42);
    expect(reverted.originDeckId).toBeNull();
    expect(reverted.boxLevel).toBe(1);
    expect(reverted.rightStreak).toBe(0);
  });

  it('refuses to revert a word whose origin deck is gone', async () => {
    const { createWord, revertFromMemorized } = setup();
    const word = await createWord({ deckId: 42, furigana: 'たべる', englishMeaning: 'to eat' });
    // Never memorized, so originDeckId is still null.
    await expect(revertFromMemorized(word.id)).rejects.toThrow('can no longer be reverted');
  });
});
