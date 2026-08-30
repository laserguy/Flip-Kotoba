export type DeckKind = 'normal' | 'memorized';

// A deck holds either vocabulary words or standalone kanji — never both.
export type DeckContent = 'words' | 'kanji';

export interface Deck {
  id: number;
  name: string;
  description: string | null;
  kind: DeckKind;
  content: DeckContent;
  createdAt: Date;
}
