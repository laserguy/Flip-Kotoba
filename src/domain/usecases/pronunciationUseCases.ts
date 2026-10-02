import type { Word } from '../entities/Word';
import type { PronunciationService } from '../repositories/PronunciationService';

export function createPronunciationUseCases(pronunciation: PronunciationService) {
  return {
    speakWord: (word: Pick<Word, 'furigana'>) => pronunciation.speak(word.furigana, 'ja-JP'),
  };
}

export type PronunciationUseCases = ReturnType<typeof createPronunciationUseCases>;
