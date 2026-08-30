import type { DeckRepository } from '../repositories/DeckRepository';
import type { KanjiRepository } from '../repositories/KanjiRepository';
import type { KanjiInput } from '../entities/Kanji';
import { applySwipe } from '../srs';

function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

function normalize(input: KanjiInput): KanjiInput {
  const character = input.character.trim();
  // A kanji entry is exactly one character. Array.from walks code points (not
  // UTF-16 units), so a kanji outside the Basic Multilingual Plane still counts
  // as one — unlike spread, which some transpile targets lower to `split('')`.
  if (Array.from(character).length !== 1) {
    throw new Error('A kanji entry must be a single character.');
  }

  return {
    deckId: input.deckId,
    character,
    onReadings: cleanList(input.onReadings),
    kunReadings: cleanList(input.kunReadings),
    meanings: cleanList(input.meanings),
    exampleWords: input.exampleWords
      .map((word) => ({ japanese: word.japanese.trim(), english: word.english.trim() }))
      .filter((word) => word.japanese && word.english),
  };
}

export function createKanjiUseCases(kanjiRepository: KanjiRepository, deckRepository: DeckRepository) {
  return {
    createKanji: async (input: KanjiInput) => kanjiRepository.create(normalize(input)),
    deleteKanji: (id: number) => kanjiRepository.delete(id),
    getKanjiById: (id: number) => kanjiRepository.findById(id),
    getDueKanji: (deckId: number, now: Date = new Date()) => kanjiRepository.getDue(deckId, now),

    recordKanjiSwipe: async (kanjiId: number, direction: 'right' | 'left', now: Date = new Date()) => {
      const current = await kanjiRepository.findById(kanjiId);
      if (!current) throw new Error(`Kanji ${kanjiId} not found`);

      const outcome = applySwipe(current, direction, now);
      const kanji = await kanjiRepository.updateReviewState(kanjiId, {
        boxLevel: outcome.boxLevel,
        rightStreak: outcome.rightStreak,
        nextDueAt: outcome.nextDueAt,
        lastReviewedAt: now,
      });

      return { kanji, readyToMemorize: outcome.readyToMemorize };
    },

    moveKanjiToMemorized: async (kanjiId: number) => {
      const memorizedDeck = await deckRepository.getOrCreateMemorized('kanji');
      const current = await kanjiRepository.findById(kanjiId);
      if (!current) throw new Error(`Kanji ${kanjiId} not found`);
      return kanjiRepository.moveToMemorized(kanjiId, memorizedDeck.id, current.deckId);
    },

    revertKanjiFromMemorized: async (kanjiId: number) => {
      const current = await kanjiRepository.findById(kanjiId);
      if (!current) throw new Error(`Kanji ${kanjiId} not found`);
      if (!current.originDeckId) {
        throw new Error('This kanji can no longer be reverted (its original deck was deleted).');
      }
      return kanjiRepository.revertFromMemorized(kanjiId, current.originDeckId);
    },
  };
}

export type KanjiUseCases = ReturnType<typeof createKanjiUseCases>;
