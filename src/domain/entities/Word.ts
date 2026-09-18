// Which way the card is being tested: shown Japanese and recalling the
// English meaning, or shown English and recalling the Japanese. Progress is
// tracked independently per direction — see WordReviewState below.
export type ReviewDirection = 'jpToEn' | 'enToJp';

export interface WordReviewState {
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date | null;
}

export interface Word {
  id: number;
  deckId: number;
  originDeckId: number | null;
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
  exampleSentenceJp: string | null;
  exampleSentenceEn: string | null;
  jpToEn: WordReviewState;
  enToJp: WordReviewState;
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
