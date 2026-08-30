export interface KanjiExampleWord {
  japanese: string;
  english: string;
}

export interface Kanji {
  id: number;
  deckId: number;
  originDeckId: number | null;
  character: string; // a single kanji, shown on its own on the flashcard front
  onReadings: string[]; // 音読み
  kunReadings: string[]; // 訓読み
  meanings: string[];
  exampleWords: KanjiExampleWord[]; // compound words containing the kanji, 0–2

  // --- SRS review state (same Leitner model as words) ---
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
}

export interface KanjiInput {
  deckId: number;
  character: string;
  onReadings: string[];
  kunReadings: string[];
  meanings: string[];
  exampleWords: KanjiExampleWord[];
}
