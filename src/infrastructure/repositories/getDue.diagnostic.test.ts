import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, asc, eq, gte, lt, lte, or } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { decks, words } from '../db/schema';
import { MEMORIZE_STREAK_THRESHOLD } from '../../domain/constants';

function freshDb() {
  const sqlite = new Database(':memory:');
  const migrationsDir = path.join(__dirname, '../../../drizzle');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8').replace(/--> statement-breakpoint/g, ''));
  }
  return drizzle(sqlite);
}

// Reproduces DrizzleWordRepository.getDue's jpToEn query, for the "due" half
// of the diagnostic below.
async function getDueJpToEn(db: ReturnType<typeof freshDb>, deckId: number, now: Date) {
  const rows = await db
    .select()
    .from(words)
    .where(
      and(
        eq(words.deckId, deckId),
        lte(words.nextDueAt, now),
        or(lt(words.rightStreak, MEMORIZE_STREAK_THRESHOLD), gte(words.reverseRightStreak, MEMORIZE_STREAK_THRESHOLD)),
      ),
    )
    .orderBy(asc(words.boxLevel), asc(words.nextDueAt));
  return rows;
}

async function getDueEnToJp(db: ReturnType<typeof freshDb>, deckId: number, now: Date) {
  const rows = await db
    .select()
    .from(words)
    .where(
      and(
        eq(words.deckId, deckId),
        lte(words.reverseNextDueAt, now),
        or(lt(words.reverseRightStreak, MEMORIZE_STREAK_THRESHOLD), gte(words.rightStreak, MEMORIZE_STREAK_THRESHOLD)),
      ),
    )
    .orderBy(asc(words.reverseBoxLevel), asc(words.reverseNextDueAt));
  return rows;
}

// Diagnostic: reproduce the exact query DrizzleWordRepository.getDue runs,
// against a real SQLite engine (better-sqlite3), using the real generated
// migration SQL — to check whether the due-date filter itself is broken,
// independent of expo-sqlite/the device.
describe('due-date query against a real SQLite database', () => {
  it('finds a freshly created word as due', async () => {
    const db = freshDb();

    const [deck] = await db.insert(decks).values({ name: 'Test Deck', kind: 'normal' }).returning();
    const [word] = await db
      .insert(words)
      .values({ deckId: deck.id, furigana: 'たべる', englishMeaning: 'to eat' })
      .returning();

    console.log('inserted word.nextDueAt:', word.nextDueAt, word.nextDueAt.toISOString());
    console.log('query now:', new Date().toISOString());

    const now = new Date();
    const due = await getDueJpToEn(db, deck.id, now);

    console.log('due rows found:', due.length);
    expect(due.map((w) => w.id)).toContain(word.id);
  });

  it('a fresh word is due in both directions independently', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Test Deck', kind: 'normal' }).returning();
    const [word] = await db
      .insert(words)
      .values({ deckId: deck.id, furigana: 'たべる', englishMeaning: 'to eat' })
      .returning();

    const now = new Date();
    expect((await getDueJpToEn(db, deck.id, now)).map((w) => w.id)).toContain(word.id);
    expect((await getDueEnToJp(db, deck.id, now)).map((w) => w.id)).toContain(word.id);
  });

  it('pauses a direction once it alone is mastered, until the other catches up', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Test Deck', kind: 'normal' }).returning();
    const [word] = await db
      .insert(words)
      .values({
        deckId: deck.id,
        furigana: 'たべる',
        englishMeaning: 'to eat',
        rightStreak: MEMORIZE_STREAK_THRESHOLD,
      })
      .returning();

    const now = new Date();
    // jpToEn is mastered alone — paused, excluded from its own due list...
    expect((await getDueJpToEn(db, deck.id, now)).map((w) => w.id)).not.toContain(word.id);
    // ...but enToJp still needs work, so it keeps showing up there.
    expect((await getDueEnToJp(db, deck.id, now)).map((w) => w.id)).toContain(word.id);
  });

  it('resumes cycling in both directions once both are mastered', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Test Deck', kind: 'normal' }).returning();
    const [word] = await db
      .insert(words)
      .values({
        deckId: deck.id,
        furigana: 'たべる',
        englishMeaning: 'to eat',
        rightStreak: MEMORIZE_STREAK_THRESHOLD,
        reverseRightStreak: MEMORIZE_STREAK_THRESHOLD,
      })
      .returning();

    const now = new Date();
    expect((await getDueJpToEn(db, deck.id, now)).map((w) => w.id)).toContain(word.id);
    expect((await getDueEnToJp(db, deck.id, now)).map((w) => w.id)).toContain(word.id);
  });
});
