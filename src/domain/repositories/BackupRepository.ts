import type { Deck } from '../entities/Deck';
import type { Word } from '../entities/Word';
import type { Kanji } from '../entities/Kanji';

// A deck to recreate during a restore. `tempId` is the id it had in the backup
// file; the repository assigns a real id and rewrites item references to match.
export interface RestoreDeck {
  tempId: number;
  name: string;
  description: string | null;
  kind: Deck['kind'];
  content: Deck['content'];
}

export interface RestoreWord {
  tempDeckId: number;
  tempOriginDeckId: number | null;
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
  exampleSentenceJp: string | null;
  exampleSentenceEn: string | null;
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date | null;
}

export interface RestoreKanji {
  tempDeckId: number;
  tempOriginDeckId: number | null;
  character: string;
  onReadings: string[];
  kunReadings: string[];
  meanings: string[];
  exampleWords: { japanese: string; english: string }[];
  boxLevel: number;
  rightStreak: number;
  nextDueAt: Date;
  lastReviewedAt: Date | null;
}

export interface BackupRepository {
  // Every deck, word and kanji currently stored, for building an export.
  readAll(): Promise<{ decks: Deck[]; words: Word[]; kanji: Kanji[] }>;

  // Atomically replace the entire library: remove all decks, words and kanji,
  // then insert the given ones, remapping tempId references to the new real
  // ids. All-or-nothing — a failure leaves the existing data untouched.
  replaceAll(decks: RestoreDeck[], words: RestoreWord[], kanji: RestoreKanji[]): Promise<void>;
}
