// This app always displays kanji readings in hiragana, regardless of source
// (vision scan, dictionary lookup, or manual entry) or which reading it is
// (on'yomi or kun'yomi). Japanese dictionaries conventionally print on'yomi
// in katakana, but that convention reads as "this is a foreign word" to this
// app's users, so every reading gets normalized here instead.
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x30a1 - 0x3041;

// ヷヸヹヺ (0x30f7-0x30fa) have no hiragana equivalent and are left as-is,
// along with the long vowel mark ー and middle dot ・.
const ITERATION_MARKS: Record<string, string> = { ヽ: 'ゝ', ヾ: 'ゞ' };

export function toHiragana(text: string): string {
  return Array.from(text)
    .map((char) => {
      if (char in ITERATION_MARKS) return ITERATION_MARKS[char];
      const code = char.codePointAt(0)!;
      return code >= KATAKANA_START && code <= KATAKANA_END ? String.fromCodePoint(code - HIRAGANA_OFFSET) : char;
    })
    .join('');
}
