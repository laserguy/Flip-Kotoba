import { toGeminiSchema } from './GeminiVisionModel';

describe('toGeminiSchema', () => {
  it('rewrites a nullable union type to type + nullable: true', () => {
    expect(toGeminiSchema({ type: ['string', 'null'] })).toEqual({ type: 'string', nullable: true });
  });

  it('leaves a plain type untouched', () => {
    expect(toGeminiSchema({ type: 'string' })).toEqual({ type: 'string' });
  });

  it('strips additionalProperties anywhere in the tree', () => {
    const input = {
      type: 'object',
      additionalProperties: false,
      properties: {
        item: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } },
      },
    };

    expect(toGeminiSchema(input)).toEqual({
      type: 'object',
      properties: {
        item: { type: 'object', properties: { name: { type: 'string' } } },
      },
    });
  });

  it('recurses through arrays and nested objects', () => {
    const input = {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kanji: { type: ['string', 'null'] },
              furigana: { type: 'string' },
            },
            required: ['kanji', 'furigana'],
          },
        },
      },
      required: ['words'],
    };

    expect(toGeminiSchema(input)).toEqual({
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kanji: { type: 'string', nullable: true },
              furigana: { type: 'string' },
            },
            required: ['kanji', 'furigana'],
          },
        },
      },
      required: ['words'],
    });
  });
});
