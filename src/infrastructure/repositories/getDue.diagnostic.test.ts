import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, asc, eq, lte } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { decks, words } from '../db/schema';

// Diagnostic: reproduce the exact query DrizzleWordRepository.getDue runs,
// against a real SQLite engine (better-sqlite3), using the real generated
// migration SQL — to check whether the due-date filter itself is broken,
// independent of expo-sqlite/the device.
describe('due-date query against a real SQLite database', () => {
  it('finds a freshly created word as due', async () => {
    const sqlite = new Database(':memory:');
    const migrationsDir = path.join(__dirname, '../../../drizzle');
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8').replace(/--> statement-breakpoint/g, ''));
    }

    const db = drizzle(sqlite);

    const [deck] = await db.insert(decks).values({ name: 'Test Deck', kind: 'normal' }).returning();
    const [word] = await db
      .insert(words)
      .values({ deckId: deck.id, furigana: 'たべる', englishMeaning: 'to eat' })
      .returning();

    console.log('inserted word.nextDueAt:', word.nextDueAt, word.nextDueAt.toISOString());
    console.log('query now:', new Date().toISOString());

    const now = new Date();
    const due = await db
      .select()
      .from(words)
      .where(and(eq(words.deckId, deck.id), lte(words.nextDueAt, now)))
      .orderBy(asc(words.boxLevel), asc(words.nextDueAt));

    console.log('due rows found:', due.length);
    expect(due.map((w) => w.id)).toContain(word.id);
  });
});
