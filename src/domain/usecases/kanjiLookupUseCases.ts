import type { KanjiDictionaryService } from '../repositories/KanjiDictionaryService';
import type { ScannedKanji } from '../repositories/KanjiPageScanner';

const MAX_EXAMPLE_WORDS = 2;

export function createKanjiLookupUseCases(dictionary: KanjiDictionaryService) {
  return {
    // Fills any field the scan left empty (on/kun readings, meanings, example
    // words) from the dictionary, keeping whatever the scan already found.
    // Returns the input unchanged if nothing is missing or the lookup finds
    // nothing.
    fillKanjiGaps: async (scanned: ScannedKanji): Promise<ScannedKanji> => {
      const isComplete =
        scanned.onReadings.length > 0 &&
        scanned.kunReadings.length > 0 &&
        scanned.meanings.length > 0 &&
        scanned.exampleWords.length > 0;
      if (isComplete) return scanned;

      const entry = await dictionary.lookup(scanned.character);
      if (!entry) return scanned;

      return {
        character: scanned.character,
        onReadings: scanned.onReadings.length > 0 ? scanned.onReadings : entry.onReadings,
        kunReadings: scanned.kunReadings.length > 0 ? scanned.kunReadings : entry.kunReadings,
        meanings: scanned.meanings.length > 0 ? scanned.meanings : entry.meanings,
        exampleWords:
          scanned.exampleWords.length > 0
            ? scanned.exampleWords
            : entry.exampleWords.slice(0, MAX_EXAMPLE_WORDS),
      };
    },
  };
}

export type KanjiLookupUseCases = ReturnType<typeof createKanjiLookupUseCases>;
