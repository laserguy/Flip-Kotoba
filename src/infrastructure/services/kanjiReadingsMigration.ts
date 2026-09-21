import { eq } from 'drizzle-orm';
import * as SecureStore from 'expo-secure-store';
import { db } from '../db/client';
import { kanji } from '../db/schema';
import { toHiragana } from '../../domain/kana';

const MIGRATION_FLAG_KEY = 'kanji_readings_migrated_to_hiragana';

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// One-time backfill for kanji saved before the app started normalizing every
// reading to hiragana at save time (on'yomi used to be stored in katakana, the
// traditional dictionary convention — see kana.ts for why this app doesn't
// follow it). Safe to call on every app launch: it's a cheap no-op once the
// flag is set.
export async function migrateKanjiReadingsToHiragana(): Promise<void> {
  if ((await SecureStore.getItemAsync(MIGRATION_FLAG_KEY)) === 'true') return;

  const rows = await db.select().from(kanji);
  for (const row of rows) {
    const onReadings = row.onReadings.map(toHiragana);
    const kunReadings = row.kunReadings.map(toHiragana);
    if (!sameList(onReadings, row.onReadings) || !sameList(kunReadings, row.kunReadings)) {
      await db.update(kanji).set({ onReadings, kunReadings }).where(eq(kanji.id, row.id));
    }
  }

  await SecureStore.setItemAsync(MIGRATION_FLAG_KEY, 'true');
}
