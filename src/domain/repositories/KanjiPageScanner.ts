export interface ScannedKanjiExampleWord {
  japanese: string;
  english: string;
}

export interface ScannedKanji {
  character: string;
  onReadings: string[];
  kunReadings: string[];
  meanings: string[];
  exampleWords: ScannedKanjiExampleWord[];
}

export interface KanjiPageScanner {
  // Extracts standalone kanji from a photographed page. Returns an empty list
  // when the page shows no standalone kanji.
  scanKanjiPage(imageBase64: string): Promise<ScannedKanji[]>;
}
