import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { words, type WordRow } from '../db/schema';
import type { Word, WordInput } from '../../domain/entities/Word';
import type { ReviewState, WordRepository } from '../../domain/repositories/WordRepository';

function toDomain(row: WordRow): Word {
  return {
    id: row.id,
    deckId: row.deckId,
    originDeckId: row.originDeckId,
    kanji: row.kanji,
    furigana: row.furigana,
    englishMeaning: row.englishMeaning,
    exampleSentenceJp: row.exampleSentenceJp,
    exampleSentenceEn: row.exampleSentenceEn,
    boxLevel: row.boxLevel,
    rightStreak: row.rightStreak,
    nextDueAt: row.nextDueAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleWordRepository implements WordRepository {
  async create(input: WordInput): Promise<Word> {
    const [row] = await db
      .insert(words)
      .values({ ...input, kanji: input.kanji ?? null, exampleSentenceJp: input.exampleSentenceJp ?? null, exampleSentenceEn: input.exampleSentenceEn ?? null })
      .returning();
    return toDomain(row);
  }

  async update(id: number, input: WordInput): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({ ...input, kanji: input.kanji ?? null, exampleSentenceJp: input.exampleSentenceJp ?? null, exampleSentenceEn: input.exampleSentenceEn ?? null })
      .where(eq(words.id, id))
      .returning();
    return toDomain(row);
  }

  async delete(id: number): Promise<void> {
    await db.delete(words).where(eq(words.id, id));
  }

  async findById(id: number): Promise<Word | null> {
    const [row] = await db.select().from(words).where(eq(words.id, id)).limit(1);
    return row ? toDomain(row) : null;
  }

  async getDue(deckId: number, now: Date): Promise<Word[]> {
    const rows = await db
      .select()
      .from(words)
      .where(and(eq(words.deckId, deckId), lte(words.nextDueAt, now)))
      .orderBy(asc(words.boxLevel), asc(words.nextDueAt));
    return rows.map(toDomain);
  }

  async updateReviewState(id: number, state: ReviewState): Promise<Word> {
    const [row] = await db.update(words).set(state).where(eq(words.id, id)).returning();
    return toDomain(row);
  }

  async moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({ deckId: memorizedDeckId, originDeckId })
      .where(eq(words.id, id))
      .returning();
    return toDomain(row);
  }

  async revertFromMemorized(id: number, originDeckId: number): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({ deckId: originDeckId, originDeckId: null, boxLevel: 1, rightStreak: 0, nextDueAt: new Date() })
      .where(eq(words.id, id))
      .returning();
    return toDomain(row);
  }
}
