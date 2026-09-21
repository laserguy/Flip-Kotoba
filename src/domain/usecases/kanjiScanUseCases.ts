import type { KanjiPageScanner, ScannedKanji } from '../repositories/KanjiPageScanner';
import { toHiragana } from '../kana';

// Readings come back from the vision model in whatever script it chose (on'yomi
// is conventionally katakana) — this app always displays hiragana, so normalize
// here rather than in the vision adapter, since script choice is a domain rule.
function toHiraganaReadings(kanji: ScannedKanji): ScannedKanji {
  return {
    ...kanji,
    onReadings: kanji.onReadings.map(toHiragana),
    kunReadings: kanji.kunReadings.map(toHiragana),
  };
}

export function createKanjiScanUseCases(scanner: KanjiPageScanner) {
  return {
    scanKanjiPage: async (imageBase64: string) => {
      const scanned = await scanner.scanKanjiPage(imageBase64);
      return scanned.map(toHiraganaReadings);
    },
  };
}

export type KanjiScanUseCases = ReturnType<typeof createKanjiScanUseCases>;
