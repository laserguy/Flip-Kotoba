import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { kanji, type KanjiRow } from '../db/schema';
import type { Kanji, KanjiInput } from '../../domain/entities/Kanji';
import type { KanjiRepository } from '../../domain/repositories/KanjiRepository';
import type { ReviewState } from '../../domain/repositories/WordRepository';

function toDomain(row: KanjiRow): Kanji {
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

export class DrizzleKanjiRepository implements KanjiRepository {
  async create(input: KanjiInput): Promise<Kanji> {
    const [row] = await db
      .insert(kanji)
      .values({
        deckId: input.deckId,
        character: input.character,
        onReadings: input.onReadings,
        kunReadings: input.kunReadings,
        meanings: input.meanings,
        exampleWords: input.exampleWords,
      })
      .returning();
    return toDomain(row);
  }

  async delete(id: number): Promise<void> {
    await db.delete(kanji).where(eq(kanji.id, id));
  }

  async findById(id: number): Promise<Kanji | null> {
    const [row] = await db.select().from(kanji).where(eq(kanji.id, id)).limit(1);
    return row ? toDomain(row) : null;
  }

  async getDue(deckId: number, now: Date): Promise<Kanji[]> {
    const rows = await db
      .select()
      .from(kanji)
      .where(and(eq(kanji.deckId, deckId), lte(kanji.nextDueAt, now)))
      .orderBy(asc(kanji.boxLevel), asc(kanji.nextDueAt));
    return rows.map(toDomain);
  }

  async updateReviewState(id: number, state: ReviewState): Promise<Kanji> {
    const [row] = await db.update(kanji).set(state).where(eq(kanji.id, id)).returning();
    return toDomain(row);
  }

  async moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Kanji> {
    const [row] = await db
      .update(kanji)
      .set({ deckId: memorizedDeckId, originDeckId })
      .where(eq(kanji.id, id))
      .returning();
    return toDomain(row);
  }

  async revertFromMemorized(id: number, originDeckId: number): Promise<Kanji> {
    const [row] = await db
      .update(kanji)
      .set({ deckId: originDeckId, originDeckId: null, boxLevel: 1, rightStreak: 0, nextDueAt: new Date() })
      .where(eq(kanji.id, id))
      .returning();
    return toDomain(row);
  }
}
