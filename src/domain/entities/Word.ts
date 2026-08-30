export interface Word {
  id: number;
  deckId: number;
  originDeckId: number | null;
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
  exampleSentenceJp: string | null;
  exampleSentenceEn: string | null;
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
}

export interface WordInput {
  deckId: number;
  kanji?: string | null;
  furigana: string;
  englishMeaning: string;
  exampleSentenceJp?: string | null;
  exampleSentenceEn?: string | null;
}
