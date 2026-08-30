import type { KanjiPageScanner, ScannedKanji } from '../../../domain/repositories/KanjiPageScanner';
import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import { KANJI_EXTRACTION_PROMPT } from '../kanjiExtractionPrompt';

const MAX_EXAMPLE_WORDS = 2;

const KANJI_SPEC: VisionExtractionSpec = {
  name: 'kanji_page',
  prompt: KANJI_EXTRACTION_PROMPT,
  jsonSchema: {
    type: 'object',
    properties: {
      kanji: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            character: { type: 'string' },
            onReadings: { type: 'array', items: { type: 'string' } },
            kunReadings: { type: 'array', items: { type: 'string' } },
            meanings: { type: 'array', items: { type: 'string' } },
            exampleWords: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  japanese: { type: 'string' },
                  english: { type: 'string' },
                },
                required: ['japanese', 'english'],
                additionalProperties: false,
              },
            },
          },
          required: ['character', 'onReadings', 'kunReadings', 'meanings', 'exampleWords'],
          additionalProperties: false,
        },
      },
    },
    required: ['kanji'],
    additionalProperties: false,
  },
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseKanji(raw: unknown): ScannedKanji[] {
  const list = (raw as { kanji?: unknown })?.kanji;
  if (!Array.isArray(list)) throw new Error('The scan returned an unexpected result.');

  return list
    .map((entry) => entry as Record<string, unknown>)
    .filter((item) => typeof item.character === 'string' && item.character.trim().length > 0)
    .map((item): ScannedKanji => ({
      character: (item.character as string).trim(),
      onReadings: toStringList(item.onReadings),
      kunReadings: toStringList(item.kunReadings),
      meanings: toStringList(item.meanings),
      exampleWords: (Array.isArray(item.exampleWords) ? item.exampleWords : [])
        .map((word) => word as Record<string, unknown>)
        .filter((word) => typeof word.japanese === 'string' && typeof word.english === 'string')
        .map((word) => ({ japanese: word.japanese as string, english: word.english as string }))
        .slice(0, MAX_EXAMPLE_WORDS),
    }));
}

export class VisionKanjiPageScanner implements KanjiPageScanner {
  constructor(private readonly model: VisionModel) {}

  async scanKanjiPage(imageBase64: string): Promise<ScannedKanji[]> {
    return parseKanji(await this.model.extract(imageBase64, KANJI_SPEC));
  }
}
