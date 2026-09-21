import { createKanjiScanUseCases } from './kanjiScanUseCases';
import { createFakeKanjiPageScanner } from '../testing/fakes';
import type { KanjiPageScanner, ScannedKanji } from '../repositories/KanjiPageScanner';

describe('kanjiScanUseCases.scanKanjiPage', () => {
  it('delegates to the scanner and returns its result', async () => {
    const result: ScannedKanji[] = [
      { character: '水', onReadings: ['すい'], kunReadings: ['みず'], meanings: ['water'], exampleWords: [] },
    ];
    const { scanKanjiPage } = createKanjiScanUseCases(createFakeKanjiPageScanner(result));

    await expect(scanKanjiPage('base64data')).resolves.toEqual(result);
  });

  it('normalizes katakana readings to hiragana, in case the model ignores the prompt', async () => {
    const scanned: ScannedKanji[] = [
      { character: '水', onReadings: ['スイ'], kunReadings: ['ミズ'], meanings: ['water'], exampleWords: [] },
    ];
    const { scanKanjiPage } = createKanjiScanUseCases(createFakeKanjiPageScanner(scanned));

    const result = await scanKanjiPage('base64data');

    expect(result[0].onReadings).toEqual(['すい']);
    expect(result[0].kunReadings).toEqual(['みず']);
  });

  it('propagates errors from the scanner', async () => {
    const scanner: KanjiPageScanner = {
      scanKanjiPage: async () => {
        throw new Error('No API key set. Add one in Settings first.');
      },
    };
    const { scanKanjiPage } = createKanjiScanUseCases(scanner);

    await expect(scanKanjiPage('base64data')).rejects.toThrow('No API key set');
  });
});
