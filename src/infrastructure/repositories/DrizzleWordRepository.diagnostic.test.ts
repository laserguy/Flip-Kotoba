import { decks } from '../db/schema';
import { db } from '../db/client';
import { DrizzleWordRepository } from './DrizzleWordRepository';
import { createWordUseCases } from '../../domain/usecases/wordUseCases';
import { createFakeDeckRepository } from '../../domain/testing/fakes';

// Unlike getDue.diagnostic.test.ts (which reproduces the query by hand), this
// swaps the expo-sqlite client for an in-memory better-sqlite3 database with
// the real migrations applied, so the actual DrizzleWordRepository code runs.
jest.mock('../db/client', () => {
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const fs = require('node:fs');
  const path = require('node:path');
  const schema = require('../db/schema');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const migrationsDir = path.join(__dirname, '../../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((file: string) => file.endsWith('.sql')).sort();
  for (const file of files) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8').replace(/--> statement-breakpoint/g, ''));
  }
  return { db: drizzle(sqlite, { schema }) };
});

const wordRepository = new DrizzleWordRepository();
const { createWord, recordSwipe, getDueWords, getDueCounts } = createWordUseCases(
  wordRepository,
  createFakeDeckRepository(),
);

let decksCreated = 0;

async function createDeckWithWords(wordCount: number) {
  decksCreated += 1;
  const [deck] = await db.insert(decks).values({ name: `Deck ${decksCreated}`, kind: 'normal' }).returning();
  const created = [];
  for (let i = 0; i < wordCount; i++) {
    created.push(await createWord({ deckId: deck.id, furigana: `ことば${i}`, englishMeaning: `word ${i}` }));
  }
  return { deckId: deck.id, words: created };
}

// SQLite stores timestamps at one-second precision, so "now" is taken a second
// after creation to be sure freshly created words count as due.
function aMomentLater(): Date {
  return new Date(Date.now() + 1000);
}

describe('DrizzleWordRepository against a real SQLite database', () => {
  it('keeps every word due in EN→JP after the whole deck is finished in JP→EN', async () => {
    // Regression: finishing one direction first must leave the other one untouched.
    const { deckId, words } = await createDeckWithWords(24);
    const now = aMomentLater();
    for (const word of words) await recordSwipe(word.id, 'jpToEn', 'right', now);

    expect(await getDueCounts(deckId, now)).toEqual({ jpToEn: 0, enToJp: 24 });
    expect((await getDueWords(deckId, 'enToJp', now)).map((word) => word.id).sort()).toEqual(
      words.map((word) => word.id).sort(),
    );
  });

  it('leaves the other direction’s schedule untouched on a swipe', async () => {
    const { words } = await createDeckWithWords(1);
    const [word] = words;
    const now = aMomentLater();

    const afterRight = (await recordSwipe(word.id, 'jpToEn', 'right', now)).word;
    expect(afterRight.enToJp).toEqual(word.enToJp);

    const afterLeft = (await recordSwipe(word.id, 'enToJp', 'left', now)).word;
    expect(afterLeft.jpToEn).toEqual(afterRight.jpToEn);
  });

  it('counts only the direction a word is due in', async () => {
    const { deckId, words } = await createDeckWithWords(3);
    const now = aMomentLater();
    await recordSwipe(words[0].id, 'enToJp', 'right', now);

    expect(await getDueCounts(deckId, now)).toEqual({ jpToEn: 3, enToJp: 2 });
  });

  it('does not count a word in a direction paused by mastery', async () => {
    const { deckId, words } = await createDeckWithWords(1);
    for (let i = 0; i < 10; i++) await recordSwipe(words[0].id, 'jpToEn', 'right', new Date('2026-01-01'));

    expect(await getDueCounts(deckId, aMomentLater())).toEqual({ jpToEn: 0, enToJp: 1 });
  });
});
