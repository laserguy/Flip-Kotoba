import { asc, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/client';
import { words } from '../db/schema';
import type { Word } from '../../domain/entities/Word';

export type WordSort = 'alphabetical' | 'created' | 'lastReviewed';

function wordsInDeckQuery(deckId: number, sort: WordSort) {
  const orderBy =
    sort === 'created'
      ? desc(words.createdAt)
      : sort === 'lastReviewed'
        ? desc(words.lastReviewedAt)
        : asc(words.furigana);

  return db.select().from(words).where(eq(words.deckId, deckId)).orderBy(orderBy);
}

// See useDecksWithCounts.ts for why this hook talks to Drizzle directly
// instead of going through WordRepository.
export function useWordsInDeck(deckId: number, sort: WordSort): Word[] | undefined {
  const { data } = useLiveQuery(wordsInDeckQuery(deckId, sort), [deckId, sort]);
  return data;
}
