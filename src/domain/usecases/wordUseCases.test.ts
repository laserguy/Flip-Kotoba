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

    const { word: updated, readyToMemorize } = await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));

    expect(updated.jpToEn.boxLevel).toBe(2);
    expect(updated.jpToEn.rightStreak).toBe(1);
    expect(readyToMemorize).toBe(false);
  });

  it('resets progress on a left swipe even after a long streak', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    for (let i = 0; i < 5; i++) await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    const { word: updated, readyToMemorize } = await recordSwipe(word.id, 'jpToEn', 'left', new Date('2026-01-01'));

    expect(updated.jpToEn.boxLevel).toBe(1);
    expect(updated.jpToEn.rightStreak).toBe(0);
    expect(readyToMemorize).toBe(false);
  });

  it('throws when the word does not exist', async () => {
    const { recordSwipe } = setup();
    await expect(recordSwipe(999, 'jpToEn', 'right')).rejects.toThrow('Word 999 not found');
  });

  it('keeps the two review directions independent', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    const { word: afterJpToEn } = await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    expect(afterJpToEn.jpToEn.rightStreak).toBe(1);
    expect(afterJpToEn.enToJp.rightStreak).toBe(0);

    const { word: afterEnToJp } = await recordSwipe(word.id, 'enToJp', 'left', new Date('2026-01-01'));
    // A left swipe on enToJp resets enToJp but must not touch jpToEn's progress.
    expect(afterEnToJp.jpToEn.rightStreak).toBe(1);
    expect(afterEnToJp.enToJp.rightStreak).toBe(0);
  });

  it('does not signal readyToMemorize until both directions hit the threshold, and acknowledges the first one that does', async () => {
    const { createWord, recordSwipe } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });

    let result;
    for (let i = 0; i < 10; i++) {
      result = await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    }
    // jpToEn alone hit the threshold — not ready yet, but acknowledged once.
    expect(result!.readyToMemorize).toBe(false);
    expect(result!.justMasteredDirection).toBe('jpToEn');
    expect(result!.word.jpToEn.rightStreak).toBe(10);

    // A further right swipe on the already-mastered direction must not
    // re-fire the acknowledgment.
    const repeat = await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-02'));
    expect(repeat.justMasteredDirection).toBeNull();

    for (let i = 0; i < 9; i++) {
      result = await recordSwipe(word.id, 'enToJp', 'right', new Date('2026-01-01'));
      expect(result.readyToMemorize).toBe(false);
    }
    // The 10th enToJp swipe completes the second direction: ready to
    // memorize, and no separate acknowledgment (the full prompt covers it).
    result = await recordSwipe(word.id, 'enToJp', 'right', new Date('2026-01-01'));
    expect(result.readyToMemorize).toBe(true);
    expect(result.justMasteredDirection).toBeNull();
  });
});

describe('wordUseCases.getDueWords', () => {
  it('pauses a direction once it alone is mastered, until the other direction catches up', async () => {
    const { createWord, recordSwipe, getDueWords } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));

    // enToJp was never swiped, so it's still due from its fresh (real-clock)
    // creation timestamp — querying with "now" covers both directions.
    const now = new Date();
    expect(await getDueWords(1, 'jpToEn', now)).toEqual([]);
    expect((await getDueWords(1, 'enToJp', now)).map((w) => w.id)).toEqual([word.id]);
  });

  it('resumes normal cycling in both directions once both are mastered', async () => {
    const { createWord, recordSwipe, getDueWords } = setup();
    const word = await createWord({ deckId: 1, furigana: 'たべる', englishMeaning: 'to eat' });
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'enToJp', 'right', new Date('2026-01-01'));

    const now = new Date();
    expect((await getDueWords(1, 'jpToEn', now)).map((w) => w.id)).toEqual([word.id]);
    expect((await getDueWords(1, 'enToJp', now)).map((w) => w.id)).toEqual([word.id]);
  });
});

describe('wordUseCases.getDueCounts', () => {
  async function createWords(createWord: ReturnType<typeof setup>['createWord'], deckId: number, count: number) {
    const created = [];
    for (let i = 0; i < count; i++) {
      created.push(await createWord({ deckId, furigana: `ことば${i}`, englishMeaning: `word ${i}` }));
    }
    return created;
  }

  it('counts fresh words as due in both directions', async () => {
    const { createWord, getDueCounts } = setup();
    await createWords(createWord, 1, 3);

    expect(await getDueCounts(1, new Date())).toEqual({ jpToEn: 3, enToJp: 3 });
  });

  it('keeps every word due in EN→JP after the whole deck is finished in JP→EN', async () => {
    // Regression: finishing one direction first must leave the other one untouched.
    const { createWord, recordSwipe, getDueCounts, getDueWords } = setup();
    const words = await createWords(createWord, 1, 24);
    const now = new Date();
    for (const word of words) await recordSwipe(word.id, 'jpToEn', 'right', now);

    expect(await getDueCounts(1, now)).toEqual({ jpToEn: 0, enToJp: 24 });
    expect((await getDueWords(1, 'enToJp', now)).map((word) => word.id).sort()).toEqual(
      words.map((word) => word.id).sort(),
    );
  });

  it('keeps every word due in JP→EN after the whole deck is finished in EN→JP', async () => {
    const { createWord, recordSwipe, getDueCounts } = setup();
    const words = await createWords(createWord, 1, 5);
    const now = new Date();
    for (const word of words) await recordSwipe(word.id, 'enToJp', 'right', now);

    expect(await getDueCounts(1, now)).toEqual({ jpToEn: 5, enToJp: 0 });
  });

  it('reports zero in both directions once both are finished for the day', async () => {
    const { createWord, recordSwipe, getDueCounts } = setup();
    const words = await createWords(createWord, 1, 2);
    const now = new Date();
    for (const word of words) {
      await recordSwipe(word.id, 'jpToEn', 'right', now);
      await recordSwipe(word.id, 'enToJp', 'right', now);
    }

    expect(await getDueCounts(1, now)).toEqual({ jpToEn: 0, enToJp: 0 });
  });

  it('counts a word only in the direction where it is due', async () => {
    const { createWord, recordSwipe, getDueCounts } = setup();
    const [knownInJpToEn, missedInJpToEn] = await createWords(createWord, 1, 2);
    const now = new Date();
    await recordSwipe(knownInJpToEn.id, 'jpToEn', 'right', now);
    await recordSwipe(missedInJpToEn.id, 'jpToEn', 'left', now);

    // The missed word drops to box 1, which is due again the same day.
    expect(await getDueCounts(1, now)).toEqual({ jpToEn: 1, enToJp: 2 });
  });

  it('does not count a word in a direction paused by mastery', async () => {
    const { createWord, recordSwipe, getDueCounts } = setup();
    const [word] = await createWords(createWord, 1, 1);
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));

    expect(await getDueCounts(1, new Date())).toEqual({ jpToEn: 0, enToJp: 1 });
  });

  it('counts a word in both directions again once both are mastered', async () => {
    const { createWord, recordSwipe, getDueCounts } = setup();
    const [word] = await createWords(createWord, 1, 1);
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    for (let i = 0; i < 10; i++) await recordSwipe(word.id, 'enToJp', 'right', new Date('2026-01-01'));

    expect(await getDueCounts(1, new Date())).toEqual({ jpToEn: 1, enToJp: 1 });
  });

  it('ignores words in other decks', async () => {
    const { createWord, getDueCounts } = setup();
    await createWords(createWord, 1, 2);
    await createWords(createWord, 2, 4);

    expect(await getDueCounts(1, new Date())).toEqual({ jpToEn: 2, enToJp: 2 });
  });

  it('reports zero for an empty deck', async () => {
    const { getDueCounts } = setup();

    expect(await getDueCounts(1, new Date())).toEqual({ jpToEn: 0, enToJp: 0 });
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

  it('reverts a memorized word back to its origin deck and resets both directions', async () => {
    const { createWord, recordSwipe, moveToMemorized, revertFromMemorized } = setup();
    const word = await createWord({ deckId: 42, furigana: 'たべる', englishMeaning: 'to eat' });
    await recordSwipe(word.id, 'jpToEn', 'right', new Date('2026-01-01'));
    await recordSwipe(word.id, 'enToJp', 'right', new Date('2026-01-01'));
    await moveToMemorized(word.id);

    const reverted = await revertFromMemorized(word.id);

    expect(reverted.deckId).toBe(42);
    expect(reverted.originDeckId).toBeNull();
    expect(reverted.jpToEn.boxLevel).toBe(1);
    expect(reverted.jpToEn.rightStreak).toBe(0);
    expect(reverted.enToJp.boxLevel).toBe(1);
    expect(reverted.enToJp.rightStreak).toBe(0);
  });

  it('refuses to revert a word whose origin deck is gone', async () => {
    const { createWord, revertFromMemorized } = setup();
    const word = await createWord({ deckId: 42, furigana: 'たべる', englishMeaning: 'to eat' });
    // Never memorized, so originDeckId is still null.
    await expect(revertFromMemorized(word.id)).rejects.toThrow('can no longer be reverted');
  });
});
