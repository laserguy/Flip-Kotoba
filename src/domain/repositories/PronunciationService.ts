export interface PronunciationService {
  speak(text: string, language: 'ja-JP'): Promise<void>;
}
