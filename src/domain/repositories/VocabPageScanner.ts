export interface ScannedWord {
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
}

export interface VocabPageScanner {
  scan(imageBase64: string): Promise<ScannedWord[]>;
}
