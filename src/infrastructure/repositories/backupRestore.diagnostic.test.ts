import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { decks, kanji, words } from '../db/schema';
import type { RestoreDeck, RestoreKanji, RestoreWord } from '../../domain/repositories/BackupRepository';

// Diagnostic: run the destructive replace-all that a backup restore performs
// against a real SQLite engine with the real migrations + constraints (FKs, the
// one-Memorized-deck-per-content partial unique index). Mirrors
// getDue.diagnostic.test.ts — DrizzleBackupRepository itself imports expo-sqlite
// and can't load in Jest, so the algorithm is reproduced here.

function freshDb(): BetterSQLite3Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const migrationsDir = path.join(__dirname, '../../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    sqlite.exec(sqlText.replace(/--> statement-breakpoint/g, ''));
  }
  return drizzle(sqlite);
}

async function replaceAll(
  db: BetterSQLite3Database,
  restoreDecks: RestoreDeck[],
  restoreWords: RestoreWord[],
  restoreKanji: RestoreKanji[] = [],
): Promise<void> {
  await db.delete(words);
  await db.delete(kanji);
  await db.delete(decks);

  const newIdByTempId = new Map<number, number>();
  for (const deck of restoreDecks) {
    const [row] = await db
      .insert(decks)
      .values({ name: deck.name, description: deck.description, kind: deck.kind, content: deck.content })
      .returning({ id: decks.id });
    newIdByTempId.set(deck.tempId, row.id);
  }

  const originDeckIdFor = (tempId: number | null): number | null =>
    tempId !== null ? newIdByTempId.get(tempId) ?? null : null;

  for (const word of restoreWords) {
    await db.insert(words).values({
      deckId: newIdByTempId.get(word.tempDeckId)!,
      originDeckId: originDeckIdFor(word.tempOriginDeckId),
      kanji: word.kanji,
      furigana: word.furigana,
      englishMeaning: word.englishMeaning,
      exampleSentenceJp: word.exampleSentenceJp,
      exampleSentenceEn: word.exampleSentenceEn,
      boxLevel: word.boxLevel,
      rightStreak: word.rightStreak,
      nextDueAt: word.nextDueAt,
      lastReviewedAt: word.lastReviewedAt,
      reverseBoxLevel: word.reverseBoxLevel,
      reverseRightStreak: word.reverseRightStreak,
      reverseNextDueAt: word.reverseNextDueAt,
      reverseLastReviewedAt: word.reverseLastReviewedAt,
    });
  }

  for (const entry of restoreKanji) {
    await db.insert(kanji).values({
      deckId: newIdByTempId.get(entry.tempDeckId)!,
      originDeckId: originDeckIdFor(entry.tempOriginDeckId),
      character: entry.character,
      onReadings: entry.onReadings,
      kunReadings: entry.kunReadings,
      meanings: entry.meanings,
      exampleWords: entry.exampleWords,
      boxLevel: entry.boxLevel,
      rightStreak: entry.rightStreak,
      nextDueAt: entry.nextDueAt,
      lastReviewedAt: entry.lastReviewedAt,
    });
  }
}

function restoreDeck(fields: Partial<RestoreDeck> & Pick<RestoreDeck, 'tempId' | 'name'>): RestoreDeck {
  return {
    tempId: fields.tempId,
    name: fields.name,
    description: fields.description ?? null,
    kind: fields.kind ?? 'normal',
    content: fields.content ?? 'words',
  };
}

function restoreWord(fields: Partial<RestoreWord> & Pick<RestoreWord, 'tempDeckId'>): RestoreWord {
  return {
    tempDeckId: fields.tempDeckId,
    tempOriginDeckId: fields.tempOriginDeckId ?? null,
    kanji: fields.kanji ?? null,
    furigana: fields.furigana ?? 'かな',
    englishMeaning: fields.englishMeaning ?? 'meaning',
    exampleSentenceJp: fields.exampleSentenceJp ?? null,
    exampleSentenceEn: fields.exampleSentenceEn ?? null,
    boxLevel: fields.boxLevel ?? 1,
    rightStreak: fields.rightStreak ?? 0,
    nextDueAt: fields.nextDueAt ?? new Date('2026-02-01T00:00:00.000Z'),
    lastReviewedAt: fields.lastReviewedAt ?? null,
    reverseBoxLevel: fields.reverseBoxLevel ?? 1,
    reverseRightStreak: fields.reverseRightStreak ?? 0,
    reverseNextDueAt: fields.reverseNextDueAt ?? new Date('2026-02-01T00:00:00.000Z'),
    reverseLastReviewedAt: fields.reverseLastReviewedAt ?? null,
  };
}

function restoreKanjiEntry(fields: Partial<RestoreKanji> & Pick<RestoreKanji, 'tempDeckId'>): RestoreKanji {
  return {
    tempDeckId: fields.tempDeckId,
    tempOriginDeckId: fields.tempOriginDeckId ?? null,
    character: fields.character ?? '水',
    onReadings: fields.onReadings ?? ['スイ'],
    kunReadings: fields.kunReadings ?? ['みず'],
    meanings: fields.meanings ?? ['water'],
    exampleWords: fields.exampleWords ?? [{ japanese: '水曜日', english: 'Wednesday' }],
    boxLevel: fields.boxLevel ?? 1,
    rightStreak: fields.rightStreak ?? 0,
    nextDueAt: fields.nextDueAt ?? new Date('2026-02-01T00:00:00.000Z'),
    lastReviewedAt: fields.lastReviewedAt ?? null,
  };
}

describe('backup restore replace-all against a real SQLite database', () => {
  it('clears prior data and rebuilds with remapped deck references', async () => {
    const db = freshDb();

    // Prior data that the restore must wipe.
    const [oldDeck] = await db.insert(decks).values({ name: 'Old', kind: 'normal' }).returning();
    await db.insert(words).values({ deckId: oldDeck.id, furigana: 'ふるい', englishMeaning: 'old' });

    const restoreDecks: RestoreDeck[] = [
      restoreDeck({ tempId: 50, name: 'Verbs' }),
      restoreDeck({ tempId: 60, name: 'Memorized', kind: 'memorized' }),
    ];
    const restoreWords: RestoreWord[] = [
      restoreWord({ tempDeckId: 50, furigana: 'かく', englishMeaning: 'to write' }),
      restoreWord({ tempDeckId: 60, tempOriginDeckId: 50, furigana: 'よむ', englishMeaning: 'to read', boxLevel: 5, rightStreak: 10 }),
    ];

    await replaceAll(db, restoreDecks, restoreWords);

    const deckRows = await db.select().from(decks);
    const wordRows = await db.select().from(words);

    expect(deckRows.map((deck) => deck.name).sort()).toEqual(['Memorized', 'Verbs']);
    expect(wordRows).toHaveLength(2);

    const verbs = deckRows.find((deck) => deck.name === 'Verbs')!;
    const memorized = deckRows.find((deck) => deck.kind === 'memorized')!;
    const read = wordRows.find((word) => word.furigana === 'よむ')!;
    expect(read.deckId).toBe(memorized.id);
    expect(read.originDeckId).toBe(verbs.id); // remapped from tempId 50
    expect(read.boxLevel).toBe(5);
  });

  it('restores kanji with remapped deck and origin-deck references and JSON fields intact', async () => {
    const db = freshDb();

    const restoreDecks: RestoreDeck[] = [
      restoreDeck({ tempId: 10, name: 'Kanji N5', content: 'kanji' }),
      restoreDeck({ tempId: 20, name: 'Memorized Kanji', kind: 'memorized', content: 'kanji' }),
    ];
    const restoreKanji: RestoreKanji[] = [
      restoreKanjiEntry({ tempDeckId: 10, character: '木', onReadings: ['モク', 'ボク'], kunReadings: ['き', 'こ'], meanings: ['tree', 'wood'] }),
      restoreKanjiEntry({
        tempDeckId: 20,
        tempOriginDeckId: 10,
        character: '水',
        boxLevel: 5,
        exampleWords: [{ japanese: '水曜日', english: 'Wednesday' }, { japanese: '水泳', english: 'swimming' }],
      }),
    ];

    await replaceAll(db, restoreDecks, [], restoreKanji);

    const deckRows = await db.select().from(decks);
    const kanjiRows = await db.select().from(kanji);

    const n5 = deckRows.find((deck) => deck.name === 'Kanji N5')!;
    const memorized = deckRows.find((deck) => deck.kind === 'memorized')!;

    const tree = kanjiRows.find((row) => row.character === '木')!;
    expect(tree.deckId).toBe(n5.id);
    expect(tree.onReadings).toEqual(['モク', 'ボク']);
    expect(tree.meanings).toEqual(['tree', 'wood']);

    const water = kanjiRows.find((row) => row.character === '水')!;
    expect(water.deckId).toBe(memorized.id);
    expect(water.originDeckId).toBe(n5.id); // remapped from tempId 10
    expect(water.exampleWords).toEqual([
      { japanese: '水曜日', english: 'Wednesday' },
      { japanese: '水泳', english: 'swimming' },
    ]);
  });

  it('cascades kanji deletion when its deck is removed', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Kanji', content: 'kanji' }).returning();
    await db.insert(kanji).values({ deckId: deck.id, character: '火' });

    await db.delete(decks);

    expect(await db.select().from(kanji)).toHaveLength(0);
  });

  it('rejects two Memorized decks of the same content via the partial unique index', async () => {
    const db = freshDb();
    const restoreDecks: RestoreDeck[] = [
      restoreDeck({ tempId: 1, name: 'Memorized', kind: 'memorized', content: 'words' }),
      restoreDeck({ tempId: 2, name: 'Memorized 2', kind: 'memorized', content: 'words' }),
    ];

    await expect(replaceAll(db, restoreDecks, [])).rejects.toThrow();
  });

  it('allows a Memorized words deck and a Memorized kanji deck to coexist', async () => {
    const db = freshDb();
    const restoreDecks: RestoreDeck[] = [
      restoreDeck({ tempId: 1, name: 'Memorized', kind: 'memorized', content: 'words' }),
      restoreDeck({ tempId: 2, name: 'Memorized Kanji', kind: 'memorized', content: 'kanji' }),
    ];

    await replaceAll(db, restoreDecks, []);

    const deckRows = await db.select().from(decks);
    expect(deckRows.map((deck) => deck.content).sort()).toEqual(['kanji', 'words']);
  });
});
