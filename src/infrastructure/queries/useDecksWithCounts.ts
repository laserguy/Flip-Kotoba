import { asc, sql } from 'drizzle-orm';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { db } from '../db/client';
import { decks } from '../db/schema';
import type { DeckContent, DeckKind } from '../../domain/entities/Deck';

export type DeckWithCounts = {
  id: number;
  name: string;
  description: string | null;
  kind: DeckKind;
  content: DeckContent;
  // Words for a word deck, kanji for a kanji deck.
  itemCount: number;
  // Items that started in this deck and have since graduated to a memorized deck.
  memorizedCount: number;
};

function decksWithCountsQuery() {
  return db
    .select({
      id: decks.id,
      name: decks.name,
      description: decks.description,
      kind: decks.kind,
      content: decks.content,
      itemCount: sql<number>`(
        case decks.content
          when 'kanji' then (select count(*) from kanji where kanji.deck_id = decks.id)
          else (select count(*) from words where words.deck_id = decks.id)
        end
      )`.as('item_count'),
      memorizedCount: sql<number>`(
        case decks.content
          when 'kanji' then (
            select count(*) from kanji k2 join decks d2 on d2.id = k2.deck_id
            where k2.origin_deck_id = decks.id and d2.kind = 'memorized'
          )
          else (
            select count(*) from words w2 join decks d2 on d2.id = w2.deck_id
            where w2.origin_deck_id = decks.id and d2.kind = 'memorized'
          )
        end
      )`.as('memorized_count'),
    })
    .from(decks)
    .orderBy(asc(decks.name));
}

// This hook talks to Drizzle directly rather than through DeckRepository, for
// the same reason documented in useWordsInDeck.ts. It can't use Drizzle's
// built-in useLiveQuery though: that hook only re-subscribes to changes on the
// query's primary FROM table (`decks` here), but the counts are computed from
// correlated subqueries against `words` / `kanji`, which Drizzle's
// change-detection never sees. So this watches all three tables directly and
// refetches whenever any of them changes.
export function useDecksWithCounts(): DeckWithCounts[] | undefined {
  const [data, setData] = useState<DeckWithCounts[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      decksWithCountsQuery().then((rows) => {
        if (!cancelled) setData(rows);
      });
    };

    refetch();
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tableName === 'decks' || tableName === 'words' || tableName === 'kanji') refetch();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return data;
}
