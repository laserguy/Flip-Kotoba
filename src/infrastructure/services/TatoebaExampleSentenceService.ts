import type { ExampleSentence, ExampleSentenceService } from '../../domain/repositories/ExampleSentenceService';

interface TatoebaApiResponse {
  results: Array<{
    text: string;
    translations: Array<Array<{ text: string; lang: string }>>;
  }>;
}

const TATOEBA_SEARCH_URL = 'https://tatoeba.org/en/api_v0/search';

export class TatoebaExampleSentenceService implements ExampleSentenceService {
  async findExample(query: string): Promise<ExampleSentence | null> {
    const url = `${TATOEBA_SEARCH_URL}?from=jpn&to=eng&query=${encodeURIComponent(query)}&sort=relevance`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Example sentence lookup failed (${response.status}).`);
    }

    const json: TatoebaApiResponse = await response.json();

    for (const result of json.results) {
      const englishTranslation = result.translations.flat().find((t) => t.lang === 'eng');
      if (englishTranslation) {
        return { japanese: result.text, english: englishTranslation.text };
      }
    }
    return null;
  }
}
