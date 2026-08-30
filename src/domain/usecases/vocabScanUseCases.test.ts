import { createVocabScanUseCases } from './vocabScanUseCases';
import type { ScannedWord, VocabPageScanner } from '../repositories/VocabPageScanner';

describe('vocabScanUseCases.scanVocabPage', () => {
  it('delegates to the scanner and returns its result', async () => {
    const words: ScannedWord[] = [{ kanji: '食べる', furigana: 'たべる', englishMeaning: 'to eat' }];
    const scanner: VocabPageScanner = { scan: async () => words };

    const { scanVocabPage } = createVocabScanUseCases(scanner);
    await expect(scanVocabPage('base64data')).resolves.toEqual(words);
  });

  it('propagates errors from the scanner (e.g. missing API key)', async () => {
    const scanner: VocabPageScanner = {
      scan: async () => {
        throw new Error('No OpenAI API key set. Add one in Settings first.');
      },
    };

    const { scanVocabPage } = createVocabScanUseCases(scanner);
    await expect(scanVocabPage('base64data')).rejects.toThrow('No OpenAI API key set');
  });
});
