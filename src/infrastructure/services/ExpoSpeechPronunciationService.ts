import * as Speech from 'expo-speech';
import type { PronunciationService } from '../../domain/repositories/PronunciationService';

export class ExpoSpeechPronunciationService implements PronunciationService {
  async speak(text: string, language: 'ja-JP'): Promise<void> {
    // Stop any utterance already in flight so rapid card swipes don't queue
    // up overlapping speech.
    await Speech.stop();

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (error) => reject(error),
      });
    });
  }
}
