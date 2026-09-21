import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { decks, kanji } from '../db/schema';
import { toHiragana } from '../../domain/kana';

// Diagnostic: run the hiragana backfill's row-scan-and-update against a real
// SQLite engine. kanjiReadingsMigration.ts itself imports expo-sqlite and
// can't load in Jest (see backupRestore.diagnostic.test.ts), so the algorithm
// is reproduced here, minus the SecureStore one-time flag.

function freshDb(): BetterSQLite3Database {
  const sqlite = new Database(':memory:');
  const migrationsDir = path.join(__dirname, '../../../drizzle');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8').replace(/--> statement-breakpoint/g, ''));
  }
  return drizzle(sqlite);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function runMigration(db: BetterSQLite3Database): Promise<void> {
  const rows = await db.select().from(kanji);
  for (const row of rows) {
    const onReadings = row.onReadings.map(toHiragana);
    const kunReadings = row.kunReadings.map(toHiragana);
    if (!sameList(onReadings, row.onReadings) || !sameList(kunReadings, row.kunReadings)) {
      await db.update(kanji).set({ onReadings, kunReadings }).where(eq(kanji.id, row.id));
    }
  }
}

describe('kanji readings hiragana backfill against a real SQLite database', () => {
  it('converts katakana readings to hiragana and leaves everything else untouched', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Kanji', content: 'kanji' }).returning();
    await db.insert(kanji).values([
      { deckId: deck.id, character: '水', onReadings: ['スイ'], kunReadings: ['みず'], meanings: ['water'] },
      { deckId: deck.id, character: '木', onReadings: ['モク', 'ボク'], kunReadings: ['き', 'こ-'], meanings: ['tree'] },
    ]);

    await runMigration(db);

    const rows = await db.select().from(kanji).orderBy(kanji.character);
    const ki = rows.find((row) => row.character === '木')!;
    const mizu = rows.find((row) => row.character === '水')!;

    expect(mizu.onReadings).toEqual(['すい']);
    expect(mizu.kunReadings).toEqual(['みず']); // already hiragana, untouched
    expect(mizu.meanings).toEqual(['water']); // untouched field

    expect(ki.onReadings).toEqual(['もく', 'ぼく']);
    expect(ki.kunReadings).toEqual(['き', 'こ-']);
  });

  it('does not write rows whose readings are already hiragana', async () => {
    const db = freshDb();
    const [deck] = await db.insert(decks).values({ name: 'Kanji', content: 'kanji' }).returning();
    await db.insert(kanji).values({ deckId: deck.id, character: '火', onReadings: ['か'], kunReadings: ['ひ'] });

    await runMigration(db);

    const [row] = await db.select().from(kanji);
    expect(row.onReadings).toEqual(['か']);
    expect(row.kunReadings).toEqual(['ひ']);
  });
});
