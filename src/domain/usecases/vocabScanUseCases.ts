import type { VocabPageScanner } from '../repositories/VocabPageScanner';

export function createVocabScanUseCases(scanner: VocabPageScanner) {
  return {
    scanVocabPage: (imageBase64: string) => scanner.scan(imageBase64),
  };
}

export type VocabScanUseCases = ReturnType<typeof createVocabScanUseCases>;
