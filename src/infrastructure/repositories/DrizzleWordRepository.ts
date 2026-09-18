import { and, asc, eq, gte, lt, lte, or } from 'drizzle-orm';
import { db } from '../db/client';
import { words, type WordRow } from '../db/schema';
import type { ReviewDirection, Word, WordInput } from '../../domain/entities/Word';
import type { ReviewState, WordRepository } from '../../domain/repositories/WordRepository';
import { MEMORIZE_STREAK_THRESHOLD } from '../../domain/constants';

// Maps a review direction onto the four columns that carry it, so getDue and
// updateReviewState can stay direction-agnostic instead of branching everywhere.
const REVIEW_COLUMNS = {
  jpToEn: {
    boxLevel: words.boxLevel,
    rightStreak: words.rightStreak,
    nextDueAt: words.nextDueAt,
    lastReviewedAt: words.lastReviewedAt,
  },
  enToJp: {
    boxLevel: words.reverseBoxLevel,
    rightStreak: words.reverseRightStreak,
    nextDueAt: words.reverseNextDueAt,
    lastReviewedAt: words.reverseLastReviewedAt,
  },
} as const;

function otherDirection(direction: ReviewDirection): ReviewDirection {
  return direction === 'jpToEn' ? 'enToJp' : 'jpToEn';
}

export function wordRowToDomain(row: WordRow): Word {
  return {
    id: row.id,
    deckId: row.deckId,
    originDeckId: row.originDeckId,
    kanji: row.kanji,
    furigana: row.furigana,
    englishMeaning: row.englishMeaning,
    exampleSentenceJp: row.exampleSentenceJp,
    exampleSentenceEn: row.exampleSentenceEn,
    jpToEn: {
      boxLevel: row.boxLevel,
      rightStreak: row.rightStreak,
      nextDueAt: row.nextDueAt,
      lastReviewedAt: row.lastReviewedAt,
    },
    enToJp: {
      boxLevel: row.reverseBoxLevel,
      rightStreak: row.reverseRightStreak,
      nextDueAt: row.reverseNextDueAt,
      lastReviewedAt: row.reverseLastReviewedAt,
    },
    createdAt: row.createdAt,
  };
}

export class DrizzleWordRepository implements WordRepository {
  async create(input: WordInput): Promise<Word> {
    const [row] = await db
      .insert(words)
      .values({ ...input, kanji: input.kanji ?? null, exampleSentenceJp: input.exampleSentenceJp ?? null, exampleSentenceEn: input.exampleSentenceEn ?? null })
      .returning();
    return wordRowToDomain(row);
  }

  async update(id: number, input: WordInput): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({ ...input, kanji: input.kanji ?? null, exampleSentenceJp: input.exampleSentenceJp ?? null, exampleSentenceEn: input.exampleSentenceEn ?? null })
      .where(eq(words.id, id))
      .returning();
    return wordRowToDomain(row);
  }

  async delete(id: number): Promise<void> {
    await db.delete(words).where(eq(words.id, id));
  }

  async findById(id: number): Promise<Word | null> {
    const [row] = await db.select().from(words).where(eq(words.id, id)).limit(1);
    return row ? wordRowToDomain(row) : null;
  }

  async getDue(deckId: number, direction: ReviewDirection, now: Date): Promise<Word[]> {
    const cols = REVIEW_COLUMNS[direction];
    const otherCols = REVIEW_COLUMNS[otherDirection(direction)];
    const rows = await db
      .select()
      .from(words)
      .where(
        and(
          eq(words.deckId, deckId),
          lte(cols.nextDueAt, now),
          // Paused: this direction is already mastered and the other isn't yet.
          // Once both are mastered, pausing stops applying (see wordUseCases.ts).
          or(lt(cols.rightStreak, MEMORIZE_STREAK_THRESHOLD), gte(otherCols.rightStreak, MEMORIZE_STREAK_THRESHOLD)),
        ),
      )
      .orderBy(asc(cols.boxLevel), asc(cols.nextDueAt));
    return rows.map(wordRowToDomain);
  }

  async updateReviewState(id: number, direction: ReviewDirection, state: ReviewState): Promise<Word> {
    const columns =
      direction === 'jpToEn'
        ? {
            boxLevel: state.boxLevel,
            rightStreak: state.rightStreak,
            nextDueAt: state.nextDueAt,
            lastReviewedAt: state.lastReviewedAt,
          }
        : {
            reverseBoxLevel: state.boxLevel,
            reverseRightStreak: state.rightStreak,
            reverseNextDueAt: state.nextDueAt,
            reverseLastReviewedAt: state.lastReviewedAt,
          };
    const [row] = await db.update(words).set(columns).where(eq(words.id, id)).returning();
    return wordRowToDomain(row);
  }

  async moveToMemorized(id: number, memorizedDeckId: number, originDeckId: number): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({ deckId: memorizedDeckId, originDeckId })
      .where(eq(words.id, id))
      .returning();
    return wordRowToDomain(row);
  }

  async revertFromMemorized(id: number, originDeckId: number): Promise<Word> {
    const [row] = await db
      .update(words)
      .set({
        deckId: originDeckId,
        originDeckId: null,
        boxLevel: 1,
        rightStreak: 0,
        nextDueAt: new Date(),
        reverseBoxLevel: 1,
        reverseRightStreak: 0,
        reverseNextDueAt: new Date(),
      })
      .where(eq(words.id, id))
      .returning();
    return wordRowToDomain(row);
  }
}
