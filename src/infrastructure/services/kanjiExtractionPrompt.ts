// Shared across every vision provider so behavior is consistent regardless of
// which one is active. Like the vocab prompt, it explicitly tells the model to
// return nothing rather than guess when the photo isn't a kanji page — the
// review screen the user sees before saving is the real safety net.
//
// Readings are asked for in hiragana script regardless of on'yomi/kun'yomi —
// the app itself also normalizes katakana to hiragana after extraction (see
// kanjiScanUseCases.ts), since a script mismatch here is still safety-netted
// there, but asking correctly up front means less for that pass to fix.
export const KANJI_EXTRACTION_PROMPT =
  'This is a photo of a page that presents individual kanji characters for study — a kanji list, kanji flashcards, or a kanji dictionary page. ' +
  'Extract ONLY kanji that are shown as standalone characters being studied. Do NOT extract kanji that merely appear inside example words, ' +
  'compound words, or sentences elsewhere on the page. ' +
  'For each standalone kanji, provide: character (the single kanji), onReadings (音読み, written in hiragana — empty list if none are shown), ' +
  'kunReadings (訓読み, written in hiragana — empty list if none are shown), meanings (the English meanings given on the page — empty list if none), ' +
  'and exampleWords (up to two compound words shown on the page that contain this kanji, each with its Japanese form and English meaning — empty list if none are shown). ' +
  'If the page shows no standalone kanji at all, return an empty list of kanji rather than guessing.';
