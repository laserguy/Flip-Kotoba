import type {
  KanjiDictionaryEntry,
  KanjiDictionaryService,
} from '../../domain/repositories/KanjiDictionaryService';

// kanjiapi.dev — free, no key. /kanji/{char} gives readings + meanings;
// /words/{char} gives compound words that contain the kanji.
const KANJI_URL = 'https://kanjiapi.dev/v1/kanji/';
const WORDS_URL = 'https://kanjiapi.dev/v1/words/';
const MAX_EXAMPLE_WORDS = 2;

interface KanjiApiKanji {
  on_readings?: string[];
  kun_readings?: string[];
  meanings?: string[];
}

interface KanjiApiWord {
  variants?: { written?: string; pronounced?: string }[];
  meanings?: { glosses?: string[] }[];
}

export class KanjiApiDictionaryService implements KanjiDictionaryService {
  async lookup(character: string): Promise<KanjiDictionaryEntry | null> {
    const response = await fetch(`${KANJI_URL}${encodeURIComponent(character)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Kanji lookup failed (${response.status}).`);

    const kanji = (await response.json()) as KanjiApiKanji;

    return {
      onReadings: kanji.on_readings ?? [],
      kunReadings: kanji.kun_readings ?? [],
      meanings: kanji.meanings ?? [],
      exampleWords: await this.fetchExampleWords(character),
    };
  }

  // Example words are a nice-to-have — a failure here shouldn't sink the whole
  // lookup, so this swallows errors and returns an empty list instead.
  private async fetchExampleWords(character: string): Promise<KanjiDictionaryEntry['exampleWords']> {
    try {
      const response = await fetch(`${WORDS_URL}${encodeURIComponent(character)}`);
      if (!response.ok) return [];
      const words = (await response.json()) as KanjiApiWord[];

      return words
        .slice(0, MAX_EXAMPLE_WORDS)
        .map((word) => ({
          japanese: word.variants?.[0]?.written ?? '',
          english: word.meanings?.[0]?.glosses?.join('; ') ?? '',
        }))
        .filter((word) => word.japanese.length > 0 && word.english.length > 0);
    } catch {
      return [];
    }
  }
}
