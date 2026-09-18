import type { DeckContent, DeckKind } from './Deck';

// Bump when the shape below changes in a way older apps can't read. restoreBackup
// refuses any file whose formatVersion is higher than this.
//   v1 → words only
//   v2 → adds a `kanji` array and `content` on decks
//   v3 → adds `reverseSrs` on words (the English→Japanese review direction)
export const BACKUP_FORMAT_VERSION = 3;

export interface BackupSrsState {
  boxLevel: number;
  rightStreak: number;
  nextDueAt: string; // ISO 8601
  lastReviewedAt: string | null; // ISO 8601
}

export interface BackupDeckEntry {
  // Stable only within this file — words and kanji reference their deck by this id.
  id: number;
  name: string;
  description: string | null;
  kind: DeckKind;
  // Optional for backward compatibility with format v1 files (which predate
  // kanji decks); restore treats a missing value as 'words'.
  content?: DeckContent;
}

export interface BackupWordEntry {
  deckId: number; // -> BackupDeckEntry.id of the deck the word currently lives in
  originDeckId: number | null; // -> BackupDeckEntry.id it came from, for memorized words
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
  exampleSentenceJp: string | null;
  exampleSentenceEn: string | null;
  // null when the export excluded review progress — restore falls back to
  // new-item defaults (box 1, streak 0, due now).
  srs: BackupSrsState | null;
  // The English→Japanese direction's progress. Absent in v1/v2 files — restore
  // treats that the same as null (fresh, never reviewed in that direction).
  reverseSrs?: BackupSrsState | null;
}

export interface BackupKanjiEntry {
  deckId: number;
  originDeckId: number | null;
  character: string;
  onReadings: string[];
  kunReadings: string[];
  meanings: string[];
  exampleWords: { japanese: string; english: string }[];
  srs: BackupSrsState | null;
}

export interface BackupSnapshot {
  formatVersion: number;
  exportedAt: string; // ISO 8601
  includesSrsProgress: boolean;
  decks: BackupDeckEntry[];
  words: BackupWordEntry[];
  // Absent in v1 files; restore treats that as an empty list.
  kanji: BackupKanjiEntry[];
}
