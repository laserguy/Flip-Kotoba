import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { decks, type DeckRow } from '../db/schema';
import type { Deck, DeckContent } from '../../domain/entities/Deck';
import type { DeckRepository } from '../../domain/repositories/DeckRepository';
import { MEMORIZED_DECK_NAME, MEMORIZED_KANJI_DECK_NAME } from '../../domain/constants';

function toDomain(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export class DrizzleDeckRepository implements DeckRepository {
  async create(input: { name: string; description: string | null; content: DeckContent }): Promise<Deck> {
    const [row] = await db
      .insert(decks)
      .values({ name: input.name, description: input.description, kind: 'normal', content: input.content })
      .returning();
    return toDomain(row);
  }

  async delete(id: number): Promise<void> {
    await db.delete(decks).where(eq(decks.id, id));
  }

  async findById(id: number): Promise<Deck | null> {
    const [row] = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
    return row ? toDomain(row) : null;
  }

  async getMemorized(content: DeckContent): Promise<Deck | null> {
    const [row] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.kind, 'memorized'), eq(decks.content, content)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async getOrCreateMemorized(content: DeckContent): Promise<Deck> {
    const existing = await this.getMemorized(content);
    if (existing) return existing;

    const name = content === 'kanji' ? MEMORIZED_KANJI_DECK_NAME : MEMORIZED_DECK_NAME;
    const [row] = await db.insert(decks).values({ name, kind: 'memorized', content }).returning();
    return toDomain(row);
  }
}
