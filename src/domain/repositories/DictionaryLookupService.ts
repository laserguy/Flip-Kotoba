export interface DictionaryEntry {
  kanji: string | null;
  furigana: string;
  englishMeaning: string;
  isCommon: boolean;
}

export interface DictionaryLookupService {
  lookup(query: string): Promise<DictionaryEntry[]>;
}
