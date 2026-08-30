import type { DeckRepository } from '../repositories/DeckRepository';
import type { WordRepository } from '../repositories/WordRepository';
import type { WordInput } from '../entities/Word';
import { applySwipe } from '../srs';

function normalize(input: WordInput): WordInput {
  const kanji = input.kanji?.trim() || null;
  const exampleSentenceJp = input.exampleSentenceJp?.trim() || null;
  const exampleSentenceEn = input.exampleSentenceEn?.trim() || null;

  if (exampleSentenceJp && !exampleSentenceEn) {
    throw new Error('An English translation is required when a Japanese example sentence is given.');
  }

  return {
    deckId: input.deckId,
    kanji,
    furigana: input.furigana.trim(),
    englishMeaning: input.englishMeaning.trim(),
    exampleSentenceJp,
    exampleSentenceEn,
  };
}

export function createWordUseCases(wordRepository: WordRepository, deckRepository: DeckRepository) {
  return {
    createWord: async (input: WordInput) => wordRepository.create(normalize(input)),
    updateWord: async (id: number, input: WordInput) => wordRepository.update(id, normalize(input)),
    deleteWord: (id: number) => wordRepository.delete(id),
    getWordById: (id: number) => wordRepository.findById(id),
    getDueWords: (deckId: number, now: Date = new Date()) => wordRepository.getDue(deckId, now),

    recordSwipe: async (wordId: number, direction: 'right' | 'left', now: Date = new Date()) => {
      const current = await wordRepository.findById(wordId);
      if (!current) throw new Error(`Word ${wordId} not found`);

      const outcome = applySwipe(current, direction, now);
      const word = await wordRepository.updateReviewState(wordId, {
        boxLevel: outcome.boxLevel,
        rightStreak: outcome.rightStreak,
        nextDueAt: outcome.nextDueAt,
        lastReviewedAt: now,
      });

      return { word, readyToMemorize: outcome.readyToMemorize };
    },

    moveToMemorized: async (wordId: number) => {
      const memorizedDeck = await deckRepository.getOrCreateMemorized('words');
      const current = await wordRepository.findById(wordId);
      if (!current) throw new Error(`Word ${wordId} not found`);
      return wordRepository.moveToMemorized(wordId, memorizedDeck.id, current.deckId);
    },

    revertFromMemorized: async (wordId: number) => {
      const current = await wordRepository.findById(wordId);
      if (!current) throw new Error(`Word ${wordId} not found`);
      if (!current.originDeckId) {
        throw new Error('This word can no longer be reverted (its original deck was deleted).');
      }
      return wordRepository.revertFromMemorized(wordId, current.originDeckId);
    },
  };
}

export type WordUseCases = ReturnType<typeof createWordUseCases>;
