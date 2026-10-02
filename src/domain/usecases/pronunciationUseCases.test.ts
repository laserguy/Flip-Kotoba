import { createPronunciationUseCases } from './pronunciationUseCases';
import type { PronunciationService } from '../repositories/PronunciationService';

function fakePronunciation(): { service: PronunciationService; calls: Array<{ text: string; language: string }> } {
  const calls: Array<{ text: string; language: string }> = [];
  return {
    calls,
    service: {
      speak: async (text, language) => {
        calls.push({ text, language });
      },
    },
  };
}

describe('pronunciationUseCases.speakWord', () => {
  it('speaks the word furigana in Japanese', async () => {
    const { service, calls } = fakePronunciation();
    const { speakWord } = createPronunciationUseCases(service);

    await speakWord({ furigana: 'たべる' });

    expect(calls).toEqual([{ text: 'たべる', language: 'ja-JP' }]);
  });
});
