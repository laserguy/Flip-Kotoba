import type { DeckRepository } from '../repositories/DeckRepository';
import type { WordRepository } from '../repositories/WordRepository';
import type { ReviewDirection, WordInput } from '../entities/Word';
import { applySwipe } from '../srs';
import { MEMORIZE_STREAK_THRESHOLD } from '../constants';
import { otherDirection, type DueCounts } from '../reviewDirection';

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
    getDueWords: (deckId: number, direction: ReviewDirection, now: Date = new Date()) =>
      wordRepository.getDue(deckId, direction, now),

    // Reuses getDue rather than a separate count query so the numbers always
    // match the cards a review session would actually show (pause rule included).
    getDueCounts: async (deckId: number, now: Date = new Date()): Promise<DueCounts> => {
      const [jpToEn, enToJp] = await Promise.all([
        wordRepository.getDue(deckId, 'jpToEn', now),
        wordRepository.getDue(deckId, 'enToJp', now),
      ]);
      return { jpToEn: jpToEn.length, enToJp: enToJp.length };
    },

    recordSwipe: async (
      wordId: number,
      direction: ReviewDirection,
      swipeDirection: 'right' | 'left',
      now: Date = new Date(),
    ) => {
      const current = await wordRepository.findById(wordId);
      if (!current) throw new Error(`Word ${wordId} not found`);

      const wasMastered = current[direction].rightStreak >= MEMORIZE_STREAK_THRESHOLD;
      const outcome = applySwipe(current[direction], swipeDirection, now);
      const word = await wordRepository.updateReviewState(wordId, direction, {
        boxLevel: outcome.boxLevel,
        rightStreak: outcome.rightStreak,
        nextDueAt: outcome.nextDueAt,
        lastReviewedAt: now,
      });

      const thisMastered = outcome.readyToMemorize;
      const otherMastered = word[otherDirection(direction)].rightStreak >= MEMORIZE_STREAK_THRESHOLD;

      return {
        word,
        // Only once both directions have independently earned it.
        readyToMemorize: thisMastered && otherMastered,
        // Fires once, the moment this direction crosses the threshold while its
        // sibling hasn't yet — used to show a brief, non-blocking acknowledgment
        // instead of the full memorize prompt.
        justMasteredDirection: !wasMastered && thisMastered && !otherMastered ? direction : null,
      };
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
