import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';

export const decks = sqliteTable('decks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  // 'memorized' marks an auto-created, system-managed deck. All other decks are
  // 'normal'. There is one memorized deck per content type — enforced by the
  // partial unique index below.
  kind: text('kind', { enum: ['normal', 'memorized'] })
    .notNull()
    .default('normal'),
  // A deck holds either vocabulary words or standalone kanji, never both.
  content: text('content', { enum: ['words', 'kanji'] })
    .notNull()
    .default('words'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('decks_single_memorized_deck_per_content')
    .on(table.content)
    .where(sql`${table.kind} = 'memorized'`),
]);

export const words = sqliteTable('words', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // The deck the word currently lives in. Points at the memorized deck once
  // the word graduates.
  deckId: integer('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),

  // The deck the word lived in before it was memorized. Null for words that
  // have never been memorized, and set back to null (permanently disabling
  // revert) if that origin deck is later deleted.
  originDeckId: integer('origin_deck_id').references(() => decks.id, { onDelete: 'set null' }),

  kanji: text('kanji'),
  furigana: text('furigana').notNull(),
  englishMeaning: text('english_meaning').notNull(),
  exampleSentenceJp: text('example_sentence_jp'),
  exampleSentenceEn: text('example_sentence_en'),

  // --- SRS review state ---
  // 1-5, interval grows with box level; resets to 1 on a left swipe.
  boxLevel: integer('box_level').notNull().default(1),
  // Consecutive right swipes; resets to 0 on any left swipe. Hitting 10
  // triggers the automatic move into the memorized deck.
  rightStreak: integer('right_streak').notNull().default(0),
  // New words are due immediately (defaults to now).
  nextDueAt: integer('next_due_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index('words_deck_id_idx').on(table.deckId),
  index('words_deck_due_idx').on(table.deckId, table.nextDueAt),
  check('words_box_level_range', sql`${table.boxLevel} between 1 and 5`),
  check('words_right_streak_range', sql`${table.rightStreak} between 0 and 10`),
  // If a sentence is given in Japanese, its English translation is mandatory.
  check(
    'words_sentence_translation_pairing',
    sql`${table.exampleSentenceJp} is null or ${table.exampleSentenceEn} is not null`,
  ),
]);

export const kanji = sqliteTable('kanji', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  deckId: integer('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  originDeckId: integer('origin_deck_id').references(() => decks.id, { onDelete: 'set null' }),

  character: text('character').notNull(),
  // Readings, meanings and example words are display-only lists, never filtered
  // or joined on, so they're stored as JSON rather than child tables.
  onReadings: text('on_readings', { mode: 'json' }).notNull().$type<string[]>().default(sql`'[]'`),
  kunReadings: text('kun_readings', { mode: 'json' }).notNull().$type<string[]>().default(sql`'[]'`),
  meanings: text('meanings', { mode: 'json' }).notNull().$type<string[]>().default(sql`'[]'`),
  exampleWords: text('example_words', { mode: 'json' })
    .notNull()
    .$type<{ japanese: string; english: string }[]>()
    .default(sql`'[]'`),

  // --- SRS review state (same Leitner model as words) ---
  boxLevel: integer('box_level').notNull().default(1),
  rightStreak: integer('right_streak').notNull().default(0),
  nextDueAt: integer('next_due_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index('kanji_deck_id_idx').on(table.deckId),
  index('kanji_deck_due_idx').on(table.deckId, table.nextDueAt),
  check('kanji_box_level_range', sql`${table.boxLevel} between 1 and 5`),
  check('kanji_right_streak_range', sql`${table.rightStreak} between 0 and 10`),
]);

// Raw row types as Drizzle infers them. The domain layer has its own
// Deck/Word/Kanji entities (src/domain/entities) that repositories map these
// rows onto — screens and use cases should never import these row types directly.
export type DeckRow = typeof decks.$inferSelect;
export type WordRow = typeof words.$inferSelect;
export type KanjiRow = typeof kanji.$inferSelect;
