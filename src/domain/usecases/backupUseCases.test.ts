import { createBackupUseCases } from './backupUseCases';
import { createFakeBackupRepository } from '../testing/fakes';
import { BACKUP_FORMAT_VERSION } from '../entities/Backup';
import type { Deck } from '../entities/Deck';
import type { Word } from '../entities/Word';
import type { Kanji } from '../entities/Kanji';

function makeDeck(fields: Partial<Deck> & Pick<Deck, 'id'>): Deck {
  return {
    id: fields.id,
    name: fields.name ?? `Deck ${fields.id}`,
    description: fields.description ?? null,
    kind: fields.kind ?? 'normal',
    content: fields.content ?? 'words',
    createdAt: fields.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeKanji(fields: Partial<Kanji> & Pick<Kanji, 'id' | 'deckId'>): Kanji {
  return {
    id: fields.id,
    deckId: fields.deckId,
    originDeckId: fields.originDeckId ?? null,
    character: fields.character ?? '水',
    onReadings: fields.onReadings ?? ['スイ'],
    kunReadings: fields.kunReadings ?? ['みず'],
    meanings: fields.meanings ?? ['water'],
    exampleWords: fields.exampleWords ?? [{ japanese: '水曜日', english: 'Wednesday' }],
    boxLevel: fields.boxLevel ?? 1,
    rightStreak: fields.rightStreak ?? 0,
    nextDueAt: fields.nextDueAt ?? new Date('2026-02-01T00:00:00.000Z'),
    lastReviewedAt: fields.lastReviewedAt ?? null,
    createdAt: fields.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeWord(fields: Partial<Word> & Pick<Word, 'id' | 'deckId'>): Word {
  return {
    id: fields.id,
    deckId: fields.deckId,
    originDeckId: fields.originDeckId ?? null,
    kanji: fields.kanji ?? null,
    furigana: fields.furigana ?? 'かな',
    englishMeaning: fields.englishMeaning ?? 'meaning',
    exampleSentenceJp: fields.exampleSentenceJp ?? null,
    exampleSentenceEn: fields.exampleSentenceEn ?? null,
    boxLevel: fields.boxLevel ?? 1,
    rightStreak: fields.rightStreak ?? 0,
    nextDueAt: fields.nextDueAt ?? new Date('2026-02-01T00:00:00.000Z'),
    lastReviewedAt: fields.lastReviewedAt ?? null,
    createdAt: fields.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('backupUseCases.createBackup', () => {
  const decks = [
    makeDeck({ id: 7, name: 'JLPT N5', description: 'starter' }),
    makeDeck({ id: 9, name: 'Memorized', kind: 'memorized' }),
  ];
  const words = [
    makeWord({ id: 1, deckId: 7, kanji: '食べる', furigana: 'たべる', englishMeaning: 'to eat' }),
    makeWord({
      id: 2,
      deckId: 9,
      originDeckId: 7,
      furigana: 'のむ',
      englishMeaning: 'to drink',
      boxLevel: 5,
      rightStreak: 10,
      nextDueAt: new Date('2026-03-10T00:00:00.000Z'),
      lastReviewedAt: new Date('2026-02-24T00:00:00.000Z'),
    }),
  ];

  it('includes review progress as ISO strings when asked', async () => {
    const { createBackup } = createBackupUseCases(createFakeBackupRepository({ decks, words }));

    const snapshot = await createBackup({ includeSrsProgress: true });

    expect(snapshot.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(snapshot.includesSrsProgress).toBe(true);
    expect(snapshot.decks).toEqual([
      { id: 7, name: 'JLPT N5', description: 'starter', kind: 'normal', content: 'words' },
      { id: 9, name: 'Memorized', description: null, kind: 'memorized', content: 'words' },
    ]);
    expect(snapshot.words[1]).toMatchObject({
      deckId: 9,
      originDeckId: 7,
      furigana: 'のむ',
      srs: {
        boxLevel: 5,
        rightStreak: 10,
        nextDueAt: '2026-03-10T00:00:00.000Z',
        lastReviewedAt: '2026-02-24T00:00:00.000Z',
      },
    });
  });

  it('omits review progress when not asked', async () => {
    const { createBackup } = createBackupUseCases(createFakeBackupRepository({ decks, words }));

    const snapshot = await createBackup({ includeSrsProgress: false });

    expect(snapshot.includesSrsProgress).toBe(false);
    expect(snapshot.words.every((word) => word.srs === null)).toBe(true);
    // Deck membership and origin deck are structure, not progress — still kept.
    expect(snapshot.words[1]).toMatchObject({ deckId: 9, originDeckId: 7 });
  });

  it('records each deck\'s content type', async () => {
    const repo = createFakeBackupRepository({
      decks: [makeDeck({ id: 1, name: 'Verbs', content: 'words' }), makeDeck({ id: 2, name: 'Kanji N5', content: 'kanji' })],
    });
    const { createBackup } = createBackupUseCases(repo);

    const snapshot = await createBackup({ includeSrsProgress: true });

    expect(snapshot.decks.map((deck) => deck.content)).toEqual(['words', 'kanji']);
  });

  it('restores a kanji deck as a kanji deck, and treats a v1 deck with no content as words', async () => {
    const target = createFakeBackupRepository();
    const { restoreBackup } = createBackupUseCases(target);

    await restoreBackup({
      formatVersion: 1,
      decks: [
        { id: 1, name: 'Legacy', description: null, kind: 'normal' },
        { id: 2, name: 'Kanji N5', description: null, kind: 'normal', content: 'kanji' },
      ],
      words: [],
    });

    const { decks: restored } = await target.readAll();
    expect(restored.find((deck) => deck.name === 'Legacy')!.content).toBe('words');
    expect(restored.find((deck) => deck.name === 'Kanji N5')!.content).toBe('kanji');
  });
});

describe('backupUseCases.restoreBackup', () => {
  function seededUseCases() {
    const repo = createFakeBackupRepository({
      decks: [makeDeck({ id: 1, name: 'Old deck' })],
      words: [makeWord({ id: 1, deckId: 1, furigana: 'ふるい' })],
    });
    return { repo, ...createBackupUseCases(repo) };
  }

  const validSnapshot = {
    formatVersion: 1,
    exportedAt: '2026-08-01T00:00:00.000Z',
    includesSrsProgress: true,
    decks: [
      { id: 50, name: 'JLPT N5', description: null, kind: 'normal' },
      { id: 60, name: 'Memorized', description: null, kind: 'memorized' },
    ],
    words: [
      {
        deckId: 50,
        originDeckId: null,
        kanji: null,
        furigana: 'たべる',
        englishMeaning: 'to eat',
        exampleSentenceJp: null,
        exampleSentenceEn: null,
        srs: { boxLevel: 3, rightStreak: 4, nextDueAt: '2026-09-01T00:00:00.000Z', lastReviewedAt: null },
      },
      {
        deckId: 60,
        originDeckId: 50,
        kanji: null,
        furigana: 'のむ',
        englishMeaning: 'to drink',
        exampleSentenceJp: null,
        exampleSentenceEn: null,
        srs: { boxLevel: 5, rightStreak: 10, nextDueAt: '2026-09-20T00:00:00.000Z', lastReviewedAt: '2026-08-30T00:00:00.000Z' },
      },
    ],
  };

  it('replaces the whole library and remaps deck references', async () => {
    const { repo, restoreBackup } = seededUseCases();

    const result = await restoreBackup(validSnapshot);

    expect(result).toEqual({ deckCount: 2, wordCount: 2, kanjiCount: 0 });

    const { decks, words } = await repo.readAll();
    expect(decks.map((deck) => deck.name)).toEqual(['JLPT N5', 'Memorized']);
    expect(decks.find((deck) => deck.name === 'Old deck')).toBeUndefined();

    const drink = words.find((word) => word.furigana === 'のむ')!;
    const memorizedDeck = decks.find((deck) => deck.kind === 'memorized')!;
    const n5Deck = decks.find((deck) => deck.name === 'JLPT N5')!;
    expect(drink.deckId).toBe(memorizedDeck.id);
    expect(drink.originDeckId).toBe(n5Deck.id);
    expect(drink.boxLevel).toBe(5);
    expect(drink.nextDueAt).toEqual(new Date('2026-09-20T00:00:00.000Z'));
  });

  it('falls back to new-word defaults when the backup has no progress', async () => {
    const { repo, restoreBackup } = seededUseCases();
    const before = Date.now();

    await restoreBackup({
      ...validSnapshot,
      includesSrsProgress: false,
      words: validSnapshot.words.map((word) => ({ ...word, srs: null })),
    });

    const { words } = await repo.readAll();
    for (const word of words) {
      expect(word.boxLevel).toBe(1);
      expect(word.rightStreak).toBe(0);
      expect(word.lastReviewedAt).toBeNull();
      expect(word.nextDueAt.getTime()).toBeGreaterThanOrEqual(before);
    }
  });

  it('drops an origin-deck reference that is not in the file', async () => {
    const { repo, restoreBackup } = seededUseCases();

    await restoreBackup({
      ...validSnapshot,
      words: [{ ...validSnapshot.words[0], deckId: 50, originDeckId: 999 }],
    });

    const { words } = await repo.readAll();
    expect(words[0].originDeckId).toBeNull();
  });

  it.each([
    ['null', null],
    ['a string', 'not json'],
    ['an array', []],
    ['no formatVersion', { decks: [], words: [] }],
    ['a newer format version', { formatVersion: BACKUP_FORMAT_VERSION + 1, decks: [], words: [] }],
    ['decks that are not a list', { formatVersion: 1, decks: {}, words: [] }],
    ['words that are not a list', { formatVersion: 1, decks: [], words: {} }],
    ['an unknown deck kind', { formatVersion: 1, decks: [{ id: 1, name: 'x', description: null, kind: 'archived' }], words: [] }],
    [
      'a word pointing at a missing deck',
      {
        formatVersion: 1,
        decks: [{ id: 1, name: 'x', description: null, kind: 'normal' }],
        words: [{ deckId: 2, originDeckId: null, kanji: null, furigana: 'x', englishMeaning: 'x', exampleSentenceJp: null, exampleSentenceEn: null, srs: null }],
      },
    ],
  ])('rejects %s without touching existing data', async (_label, raw) => {
    const { repo, restoreBackup } = seededUseCases();

    await expect(restoreBackup(raw)).rejects.toThrow();

    const { decks } = await repo.readAll();
    expect(decks.map((deck) => deck.name)).toEqual(['Old deck']);
  });
});

describe('backup round trip', () => {
  it('createBackup -> restoreBackup preserves decks, words and progress', async () => {
    const source = createFakeBackupRepository({
      decks: [makeDeck({ id: 3, name: 'Verbs' }), makeDeck({ id: 8, name: 'Memorized', kind: 'memorized' })],
      words: [
        makeWord({ id: 1, deckId: 3, kanji: '書く', furigana: 'かく', englishMeaning: 'to write', boxLevel: 2, rightStreak: 3 }),
        makeWord({ id: 2, deckId: 8, originDeckId: 3, furigana: 'よむ', englishMeaning: 'to read', boxLevel: 5, rightStreak: 10, lastReviewedAt: new Date('2026-05-05T00:00:00.000Z') }),
      ],
    });
    const target = createFakeBackupRepository();

    const snapshot = await createBackupUseCases(source).createBackup({ includeSrsProgress: true });
    await createBackupUseCases(target).restoreBackup(snapshot);

    const restored = await target.readAll();
    expect(restored.decks.map((deck) => ({ name: deck.name, kind: deck.kind }))).toEqual([
      { name: 'Verbs', kind: 'normal' },
      { name: 'Memorized', kind: 'memorized' },
    ]);

    const read = restored.words.find((word) => word.furigana === 'よむ')!;
    expect(read.englishMeaning).toBe('to read');
    expect(read.boxLevel).toBe(5);
    expect(read.rightStreak).toBe(10);
    expect(read.lastReviewedAt).toEqual(new Date('2026-05-05T00:00:00.000Z'));
    expect(restored.decks.find((deck) => deck.id === read.originDeckId)?.name).toBe('Verbs');
  });

  it('createBackup -> restoreBackup preserves kanji, their deck, and progress', async () => {
    const source = createFakeBackupRepository({
      decks: [makeDeck({ id: 4, name: 'Kanji N5', content: 'kanji' }), makeDeck({ id: 5, name: 'Memorized Kanji', kind: 'memorized', content: 'kanji' })],
      kanji: [
        makeKanji({ id: 1, deckId: 4, character: '木', onReadings: ['モク', 'ボク'], kunReadings: ['き'], meanings: ['tree', 'wood'] }),
        makeKanji({
          id: 2,
          deckId: 5,
          originDeckId: 4,
          character: '水',
          boxLevel: 5,
          rightStreak: 10,
          lastReviewedAt: new Date('2026-06-06T00:00:00.000Z'),
          exampleWords: [{ japanese: '水曜日', english: 'Wednesday' }, { japanese: '水泳', english: 'swimming' }],
        }),
      ],
    });
    const target = createFakeBackupRepository();

    const snapshot = await createBackupUseCases(source).createBackup({ includeSrsProgress: true });
    expect(snapshot.kanji).toHaveLength(2);

    const result = await createBackupUseCases(target).restoreBackup(snapshot);
    expect(result).toEqual({ deckCount: 2, wordCount: 0, kanjiCount: 2 });

    const restored = await target.readAll();
    const tree = restored.kanji.find((entry) => entry.character === '木')!;
    expect(tree.onReadings).toEqual(['モク', 'ボク']);
    expect(tree.meanings).toEqual(['tree', 'wood']);
    expect(restored.decks.find((deck) => deck.id === tree.deckId)?.name).toBe('Kanji N5');

    const water = restored.kanji.find((entry) => entry.character === '水')!;
    expect(water.boxLevel).toBe(5);
    expect(water.exampleWords).toHaveLength(2);
    expect(restored.decks.find((deck) => deck.id === water.deckId)?.kind).toBe('memorized');
    expect(restored.decks.find((deck) => deck.id === water.originDeckId)?.name).toBe('Kanji N5');
  });

  it('drops kanji progress when the export excluded it', async () => {
    const source = createFakeBackupRepository({
      decks: [makeDeck({ id: 1, name: 'Kanji', content: 'kanji' })],
      kanji: [makeKanji({ id: 1, deckId: 1, boxLevel: 4, rightStreak: 7 })],
    });
    const target = createFakeBackupRepository();

    const snapshot = await createBackupUseCases(source).createBackup({ includeSrsProgress: false });
    expect(snapshot.kanji[0].srs).toBeNull();

    await createBackupUseCases(target).restoreBackup(snapshot);
    const { kanji } = await target.readAll();
    expect(kanji[0].boxLevel).toBe(1);
    expect(kanji[0].rightStreak).toBe(0);
  });

  it('rejects a kanji pointing at a deck not in the file', async () => {
    const target = createFakeBackupRepository({ decks: [makeDeck({ id: 1, name: 'Existing', content: 'kanji' })] });
    const { restoreBackup } = createBackupUseCases(target);

    await expect(
      restoreBackup({
        formatVersion: 2,
        decks: [{ id: 1, name: 'Kanji', description: null, kind: 'normal', content: 'kanji' }],
        words: [],
        kanji: [
          {
            deckId: 99,
            originDeckId: null,
            character: '水',
            onReadings: [],
            kunReadings: [],
            meanings: [],
            exampleWords: [],
            srs: null,
          },
        ],
      }),
    ).rejects.toThrow(/deck that isn't in the file/);

    const { decks } = await target.readAll();
    expect(decks.map((deck) => deck.name)).toEqual(['Existing']);
  });
});
