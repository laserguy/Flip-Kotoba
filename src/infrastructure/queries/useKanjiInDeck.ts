import { asc, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/client';
import { kanji } from '../db/schema';
import type { Kanji } from '../../domain/entities/Kanji';

export type KanjiSort = 'alphabetical' | 'created' | 'lastReviewed';

function kanjiInDeckQuery(deckId: number, sort: KanjiSort) {
  const orderBy =
    sort === 'created'
      ? desc(kanji.createdAt)
      : sort === 'lastReviewed'
        ? desc(kanji.lastReviewedAt)
        : asc(kanji.character);

  return db.select().from(kanji).where(eq(kanji.deckId, deckId)).orderBy(orderBy);
}

// See useDecksWithCounts.ts for why this hook talks to Drizzle directly instead
// of going through KanjiRepository.
export function useKanjiInDeck(deckId: number, sort: KanjiSort): Kanji[] | undefined {
  const { data } = useLiveQuery(kanjiInDeckQuery(deckId, sort), [deckId, sort]);
  return data;
}
