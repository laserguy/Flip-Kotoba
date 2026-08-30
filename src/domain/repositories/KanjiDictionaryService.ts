export interface KanjiDictionaryEntry {
  onReadings: string[];
  kunReadings: string[];
  meanings: string[];
  exampleWords: { japanese: string; english: string }[];
}

export interface KanjiDictionaryService {
  // Looks up a single kanji. Returns null when the character is unknown to the
  // dictionary.
  lookup(character: string): Promise<KanjiDictionaryEntry | null>;
}
