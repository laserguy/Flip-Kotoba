import type { DictionaryEntry, DictionaryLookupService } from '../../domain/repositories/DictionaryLookupService';

interface JishoApiResponse {
  data: Array<{
    is_common?: boolean;
    japanese: Array<{ word?: string; reading?: string }>;
    senses: Array<{ english_definitions: string[] }>;
  }>;
}

const JISHO_SEARCH_URL = 'https://jisho.org/api/v1/search/words';

export class JishoDictionaryLookupService implements DictionaryLookupService {
  async lookup(query: string): Promise<DictionaryEntry[]> {
    const response = await fetch(`${JISHO_SEARCH_URL}?keyword=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Dictionary lookup failed (${response.status}).`);
    }

    const json: JishoApiResponse = await response.json();

    return json.data
      .slice(0, 10)
      .flatMap((entry): DictionaryEntry[] => {
        const primaryForm = entry.japanese[0];
        const meaning = entry.senses[0]?.english_definitions.join('; ');
        if (!primaryForm?.reading || !meaning) return [];

        return [
          {
            kanji: primaryForm.word && primaryForm.word !== primaryForm.reading ? primaryForm.word : null,
            furigana: primaryForm.reading,
            englishMeaning: meaning,
            isCommon: entry.is_common ?? false,
          },
        ];
      });
  }
}
