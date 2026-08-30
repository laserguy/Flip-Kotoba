import type { KanjiPageScanner } from '../repositories/KanjiPageScanner';

export function createKanjiScanUseCases(scanner: KanjiPageScanner) {
  return {
    scanKanjiPage: (imageBase64: string) => scanner.scanKanjiPage(imageBase64),
  };
}

export type KanjiScanUseCases = ReturnType<typeof createKanjiScanUseCases>;
