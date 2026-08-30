import type { DeckContent } from '../domain/entities/Deck';

export type RootStackParamList = {
  Onboarding: { mode: 'first-launch' | 'replay' };
  DeckList: undefined;
  DeckDetail: { deckId: number; deckName: string; deckKind: 'normal' | 'memorized'; deckContent: DeckContent };
  DeckForm: { content: DeckContent };
  WordForm: { deckId: number; wordId?: number };
  WordDetail: { wordId: number };
  Settings: undefined;
  ScanVocab: { deckId: number; deckName: string };
  ScanKanji: { deckId: number; deckName: string };
  KanjiDetail: { kanjiId: number };
};
