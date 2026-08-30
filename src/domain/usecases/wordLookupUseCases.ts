import type { DictionaryLookupService } from '../repositories/DictionaryLookupService';
import type { ExampleSentenceService } from '../repositories/ExampleSentenceService';

export function createWordLookupUseCases(
  dictionary: DictionaryLookupService,
  exampleSentences: ExampleSentenceService,
) {
  return {
    lookupWord: async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) throw new Error('Enter a word to look up first.');

      const [entries, example] = await Promise.all([
        dictionary.lookup(trimmed),
        exampleSentences.findExample(trimmed).catch(() => null),
      ]);

      if (entries.length === 0) {
        throw new Error(`No dictionary entry found for "${trimmed}".`);
      }

      const best = entries.find((e) => e.isCommon) ?? entries[0];
      return { entry: best, example };
    },
  };
}

export type WordLookupUseCases = ReturnType<typeof createWordLookupUseCases>;
