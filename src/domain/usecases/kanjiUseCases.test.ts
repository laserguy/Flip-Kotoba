import { createKanjiUseCases } from './kanjiUseCases';
import { createFakeDeckRepository, createFakeKanjiRepository } from '../testing/fakes';
import { MEMORIZE_STREAK_THRESHOLD } from '../constants';

function setup() {
  const deckRepository = createFakeDeckRepository();
  const kanjiRepository = createFakeKanjiRepository();
  return { ...createKanjiUseCases(kanjiRepository, deckRepository), kanjiRepository, deckRepository };
}

const baseInput = {
  deckId: 1,
  character: '水',
  onReadings: ['スイ'],
  kunReadings: ['みず'],
  meanings: ['water'],
  exampleWords: [{ japanese: '水曜日', english: 'Wednesday' }],
};

describe('kanjiUseCases.createKanji', () => {
  it('trims and de-duplicates readings, meanings and example words', async () => {
    const { createKanji } = setup();
    const kanji = await createKanji({
      ...baseInput,
      onReadings: ['  スイ  ', 'スイ', ''],
      kunReadings: ['みず', '  '],
      meanings: ['  water  ', 'water', 'flood'],
      exampleWords: [
        { japanese: '  水曜日  ', english: '  Wednesday  ' },
        { japanese: '海水', english: '' },
      ],
    });

    expect(kanji.onReadings).toEqual(['すい']);
    expect(kanji.kunReadings).toEqual(['みず']);
    expect(kanji.meanings).toEqual(['water', 'flood']);
    expect(kanji.exampleWords).toEqual([{ japanese: '水曜日', english: 'Wednesday' }]);
  });

  it('converts katakana readings to hiragana', async () => {
    const { createKanji } = setup();
    const kanji = await createKanji({ ...baseInput, onReadings: ['スイ'], kunReadings: ['ミズ'] });

    expect(kanji.onReadings).toEqual(['すい']);
    expect(kanji.kunReadings).toEqual(['みず']);
  });

  it('rejects an entry that is not exactly one character', async () => {
    const { createKanji } = setup();
    await expect(createKanji({ ...baseInput, character: '水曜' })).rejects.toThrow('single character');
    await expect(createKanji({ ...baseInput, character: '  ' })).rejects.toThrow('single character');
  });

  it('accepts a kanji outside the Basic Multilingual Plane as one character', async () => {
    const { createKanji } = setup();
    const kanji = await createKanji({ ...baseInput, character: '𠮟' }); // U+20B9F, a surrogate pair
    expect(kanji.character).toBe('𠮟');
  });
});

describe('kanjiUseCases.recordKanjiSwipe', () => {
  it('advances the box and streak on a right swipe', async () => {
    const { createKanji, recordKanjiSwipe } = setup();
    const kanji = await createKanji(baseInput);

    const { kanji: updated, readyToMemorize } = await recordKanjiSwipe(kanji.id, 'right', new Date('2026-01-01'));

    expect(updated.boxLevel).toBe(2);
    expect(updated.rightStreak).toBe(1);
    expect(readyToMemorize).toBe(false);
  });

  it('signals readyToMemorize once the streak reaches the threshold', async () => {
    const { createKanji, recordKanjiSwipe } = setup();
    const kanji = await createKanji(baseInput);

    let readyToMemorize = false;
    for (let i = 0; i < MEMORIZE_STREAK_THRESHOLD; i++) {
      ({ readyToMemorize } = await recordKanjiSwipe(kanji.id, 'right', new Date('2026-01-01')));
    }

    expect(readyToMemorize).toBe(true);
  });

  it('resets the box and streak on a left swipe', async () => {
    const { createKanji, recordKanjiSwipe } = setup();
    const kanji = await createKanji(baseInput);
    await recordKanjiSwipe(kanji.id, 'right', new Date('2026-01-01'));

    const { kanji: updated } = await recordKanjiSwipe(kanji.id, 'left', new Date('2026-01-01'));

    expect(updated.boxLevel).toBe(1);
    expect(updated.rightStreak).toBe(0);
  });

  it('throws when the kanji does not exist', async () => {
    const { recordKanjiSwipe } = setup();
    await expect(recordKanjiSwipe(999, 'right')).rejects.toThrow('Kanji 999 not found');
  });
});

describe('kanjiUseCases.moveKanjiToMemorized / revertKanjiFromMemorized', () => {
  it('moves a kanji into a lazily-created Memorized Kanji deck, remembering its origin', async () => {
    const { createKanji, moveKanjiToMemorized, deckRepository } = setup();
    const kanji = await createKanji({ ...baseInput, deckId: 42 });

    const moved = await moveKanjiToMemorized(kanji.id);
    const memorizedDeck = await deckRepository.getMemorized('kanji');

    expect(memorizedDeck).not.toBeNull();
    expect(memorizedDeck!.content).toBe('kanji');
    expect(moved.deckId).toBe(memorizedDeck!.id);
    expect(moved.originDeckId).toBe(42);
  });

  it('does not reuse the words Memorized deck for kanji', async () => {
    const { createKanji, moveKanjiToMemorized, deckRepository } = setup();
    const kanji = await createKanji({ ...baseInput, deckId: 42 });

    await moveKanjiToMemorized(kanji.id);

    expect(await deckRepository.getMemorized('words')).toBeNull();
  });

  it('reverts a memorized kanji to its origin deck and resets review state', async () => {
    const { createKanji, moveKanjiToMemorized, revertKanjiFromMemorized } = setup();
    const kanji = await createKanji({ ...baseInput, deckId: 42 });
    await moveKanjiToMemorized(kanji.id);

    const reverted = await revertKanjiFromMemorized(kanji.id);

    expect(reverted.deckId).toBe(42);
    expect(reverted.originDeckId).toBeNull();
    expect(reverted.boxLevel).toBe(1);
    expect(reverted.rightStreak).toBe(0);
  });

  it('refuses to revert when the origin deck is gone', async () => {
    const { createKanji, revertKanjiFromMemorized } = setup();
    const kanji = await createKanji(baseInput);

    await expect(revertKanjiFromMemorized(kanji.id)).rejects.toThrow('can no longer be reverted');
  });
});
