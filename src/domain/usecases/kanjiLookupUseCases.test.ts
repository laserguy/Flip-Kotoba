import { createKanjiLookupUseCases } from './kanjiLookupUseCases';
import { createFakeKanjiDictionaryService } from '../testing/fakes';
import type { ScannedKanji } from '../repositories/KanjiPageScanner';

const emptyScan: ScannedKanji = {
  character: '水',
  onReadings: [],
  kunReadings: [],
  meanings: [],
  exampleWords: [],
};

const dictionaryEntry = {
  onReadings: ['スイ'],
  kunReadings: ['みず', 'みず-'],
  meanings: ['water', 'liquid'],
  exampleWords: [
    { japanese: '水曜日', english: 'Wednesday' },
    { japanese: '水泳', english: 'swimming' },
    { japanese: '海水', english: 'seawater' },
  ],
};

function setup(entry = dictionaryEntry) {
  const dictionary = createFakeKanjiDictionaryService({ 水: entry });
  return createKanjiLookupUseCases(dictionary);
}

describe('kanjiLookupUseCases.fillKanjiGaps', () => {
  it('fills every empty field from the dictionary, capping example words at 2', async () => {
    const { fillKanjiGaps } = setup();

    const filled = await fillKanjiGaps(emptyScan);

    expect(filled.onReadings).toEqual(['スイ']);
    expect(filled.kunReadings).toEqual(['みず', 'みず-']);
    expect(filled.meanings).toEqual(['water', 'liquid']);
    expect(filled.exampleWords).toEqual([
      { japanese: '水曜日', english: 'Wednesday' },
      { japanese: '水泳', english: 'swimming' },
    ]);
  });

  it('keeps fields the scan already captured and only fills the rest', async () => {
    const { fillKanjiGaps } = setup();

    const filled = await fillKanjiGaps({
      ...emptyScan,
      kunReadings: ['みず'],
      exampleWords: [{ japanese: '水星', english: 'Mercury' }],
    });

    expect(filled.kunReadings).toEqual(['みず']); // kept
    expect(filled.exampleWords).toEqual([{ japanese: '水星', english: 'Mercury' }]); // kept
    expect(filled.onReadings).toEqual(['スイ']); // filled
    expect(filled.meanings).toEqual(['water', 'liquid']); // filled
  });

  it('returns the scan untouched when nothing is missing', async () => {
    let lookups = 0;
    const dictionary = {
      lookup: async () => {
        lookups += 1;
        return dictionaryEntry;
      },
    };
    const { fillKanjiGaps } = createKanjiLookupUseCases(dictionary);

    const complete: ScannedKanji = {
      character: '水',
      onReadings: ['スイ'],
      kunReadings: ['みず'],
      meanings: ['water'],
      exampleWords: [{ japanese: '水曜日', english: 'Wednesday' }],
    };

    await expect(fillKanjiGaps(complete)).resolves.toEqual(complete);
    expect(lookups).toBe(0);
  });

  it('returns the scan unchanged when the dictionary has no entry', async () => {
    const { fillKanjiGaps } = setup();

    const unknown: ScannedKanji = { ...emptyScan, character: '𠮟' };
    await expect(fillKanjiGaps(unknown)).resolves.toEqual(unknown);
  });
});
