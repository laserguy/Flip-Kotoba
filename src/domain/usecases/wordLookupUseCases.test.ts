import { createWordLookupUseCases } from './wordLookupUseCases';
import type { DictionaryEntry, DictionaryLookupService } from '../repositories/DictionaryLookupService';
import type { ExampleSentence, ExampleSentenceService } from '../repositories/ExampleSentenceService';

function fakeDictionary(entries: DictionaryEntry[]): DictionaryLookupService {
  return { lookup: async () => entries };
}

function fakeExamples(example: ExampleSentence | null): ExampleSentenceService {
  return { findExample: async () => example };
}

describe('wordLookupUseCases.lookupWord', () => {
  it('prefers the common entry over other candidates', async () => {
    const { lookupWord } = createWordLookupUseCases(
      fakeDictionary([
        { kanji: '食べる', furigana: 'たべる', englishMeaning: 'to live on (e.g. a salary)', isCommon: false },
        { kanji: '食べる', furigana: 'たべる', englishMeaning: 'to eat', isCommon: true },
      ]),
      fakeExamples(null),
    );

    const { entry } = await lookupWord('食べる');
    expect(entry.englishMeaning).toBe('to eat');
  });

  it('falls back to the first entry when none are marked common', async () => {
    const { lookupWord } = createWordLookupUseCases(
      fakeDictionary([{ kanji: null, furigana: 'ねこ', englishMeaning: 'cat', isCommon: false }]),
      fakeExamples(null),
    );

    const { entry } = await lookupWord('ねこ');
    expect(entry.englishMeaning).toBe('cat');
  });

  it('returns the example sentence alongside the dictionary entry', async () => {
    const { lookupWord } = createWordLookupUseCases(
      fakeDictionary([{ kanji: '食べる', furigana: 'たべる', englishMeaning: 'to eat', isCommon: true }]),
      fakeExamples({ japanese: '朝ごはんを食べる。', english: 'I eat breakfast.' }),
    );

    const { example } = await lookupWord('食べる');
    expect(example).toEqual({ japanese: '朝ごはんを食べる。', english: 'I eat breakfast.' });
  });

  it('throws when the dictionary has no entries for the query', async () => {
    const { lookupWord } = createWordLookupUseCases(fakeDictionary([]), fakeExamples(null));
    await expect(lookupWord('xyzzy')).rejects.toThrow('No dictionary entry found');
  });

  it('rejects a blank query', async () => {
    const { lookupWord } = createWordLookupUseCases(fakeDictionary([]), fakeExamples(null));
    await expect(lookupWord('   ')).rejects.toThrow('Enter a word to look up first.');
  });

  it('still returns a result when the example-sentence lookup fails', async () => {
    const failingExamples: ExampleSentenceService = {
      findExample: async () => {
        throw new Error('network error');
      },
    };
    const { lookupWord } = createWordLookupUseCases(
      fakeDictionary([{ kanji: null, furigana: 'ねこ', englishMeaning: 'cat', isCommon: true }]),
      failingExamples,
    );

    const { entry, example } = await lookupWord('ねこ');
    expect(entry.englishMeaning).toBe('cat');
    expect(example).toBeNull();
  });
});
