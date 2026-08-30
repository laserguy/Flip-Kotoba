import type { ScannedWord, VocabPageScanner } from '../../../domain/repositories/VocabPageScanner';
import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import { VOCAB_EXTRACTION_PROMPT } from '../vocabExtractionPrompt';

const VOCAB_SPEC: VisionExtractionSpec = {
  name: 'vocab_page',
  prompt: VOCAB_EXTRACTION_PROMPT,
  jsonSchema: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kanji: { type: ['string', 'null'] },
            furigana: { type: 'string' },
            englishMeaning: { type: 'string' },
          },
          required: ['kanji', 'furigana', 'englishMeaning'],
          additionalProperties: false,
        },
      },
    },
    required: ['words'],
    additionalProperties: false,
  },
};

function parseWords(raw: unknown): ScannedWord[] {
  const list = (raw as { words?: unknown })?.words;
  if (!Array.isArray(list)) throw new Error('The scan returned an unexpected result.');

  return list.map((entry): ScannedWord => {
    const item = entry as Record<string, unknown>;
    const kanji = typeof item.kanji === 'string' && item.kanji.trim() ? item.kanji : null;
    return {
      kanji,
      furigana: typeof item.furigana === 'string' ? item.furigana : '',
      englishMeaning: typeof item.englishMeaning === 'string' ? item.englishMeaning : '',
    };
  });
}

export class VisionVocabPageScanner implements VocabPageScanner {
  constructor(private readonly model: VisionModel) {}

  async scan(imageBase64: string): Promise<ScannedWord[]> {
    return parseWords(await this.model.extract(imageBase64, VOCAB_SPEC));
  }
}
