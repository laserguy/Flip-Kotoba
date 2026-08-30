import { db } from '../db/client';
import { decks, kanji, words, type DeckRow, type KanjiRow, type WordRow } from '../db/schema';
import type { Deck } from '../../domain/entities/Deck';
import type { Word } from '../../domain/entities/Word';
import type { Kanji } from '../../domain/entities/Kanji';
import type {
  BackupRepository,
  RestoreDeck,
  RestoreKanji,
  RestoreWord,
} from '../../domain/repositories/BackupRepository';

function deckToDomain(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function wordToDomain(row: WordRow): Word {
  return {
    id: row.id,
    deckId: row.deckId,
    originDeckId: row.originDeckId,
    kanji: row.kanji,
    furigana: row.furigana,
    englishMeaning: row.englishMeaning,
    exampleSentenceJp: row.exampleSentenceJp,
    exampleSentenceEn: row.exampleSentenceEn,
    boxLevel: row.boxLevel,
    rightStreak: row.rightStreak,
    nextDueAt: row.nextDueAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

function kanjiToDomain(row: KanjiRow): Kanji {
  return {
    id: row.id,
    deckId: row.deckId,
    originDeckId: row.originDeckId,
    character: row.character,
    onReadings: row.onReadings,
    kunReadings: row.kunReadings,
    meanings: row.meanings,
    exampleWords: row.exampleWords,
    boxLevel: row.boxLevel,
    rightStreak: row.rightStreak,
    nextDueAt: row.nextDueAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleBackupRepository implements BackupRepository {
  async readAll(): Promise<{ decks: Deck[]; words: Word[]; kanji: Kanji[] }> {
    const [deckRows, wordRows, kanjiRows] = await Promise.all([
      db.select().from(decks),
      db.select().from(words),
      db.select().from(kanji),
    ]);
    return {
      decks: deckRows.map(deckToDomain),
      words: wordRows.map(wordToDomain),
      kanji: kanjiRows.map(kanjiToDomain),
    };
  }

  async replaceAll(
    restoreDecks: RestoreDeck[],
    restoreWords: RestoreWord[],
    restoreKanji: RestoreKanji[],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Items first — they carry foreign keys to decks.
      await tx.delete(words);
      await tx.delete(kanji);
      await tx.delete(decks);

      const newIdByTempId = new Map<number, number>();
      for (const deck of restoreDecks) {
        const [row] = await tx
          .insert(decks)
          .values({ name: deck.name, description: deck.description, kind: deck.kind, content: deck.content })
          .returning({ id: decks.id });
        newIdByTempId.set(deck.tempId, row.id);
      }

      const deckIdFor = (tempId: number, label: string): number => {
        const id = newIdByTempId.get(tempId);
        if (id === undefined) {
          throw new Error(`Backup restore: ${label} references deck ${tempId}, which was not in the file.`);
        }
        return id;
      };
      const originDeckIdFor = (tempId: number | null): number | null =>
        tempId !== null ? newIdByTempId.get(tempId) ?? null : null;

      for (const word of restoreWords) {
        await tx.insert(words).values({
          deckId: deckIdFor(word.tempDeckId, 'word'),
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
        });
      }

      for (const entry of restoreKanji) {
        await tx.insert(kanji).values({
          deckId: deckIdFor(entry.tempDeckId, 'kanji'),
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
    });
  }
}
