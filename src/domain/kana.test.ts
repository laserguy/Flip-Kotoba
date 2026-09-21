import { toHiragana } from './kana';

describe('toHiragana', () => {
  it('converts a katakana on-yomi reading to hiragana', () => {
    expect(toHiragana('スイ')).toBe('すい');
  });

  it('converts readings with small kana (yōon)', () => {
    expect(toHiragana('ジョウ')).toBe('じょう');
  });

  it('leaves an already-hiragana reading unchanged', () => {
    expect(toHiragana('みず')).toBe('みず');
  });

  it('leaves non-kana characters unchanged', () => {
    expect(toHiragana('water')).toBe('water');
  });

  it('passes through the long vowel mark, which has no hiragana equivalent', () => {
    expect(toHiragana('ラーメン')).toBe('らーめん');
  });

  it('converts the katakana iteration mark', () => {
    expect(toHiragana('ヽ')).toBe('ゝ');
  });

  it('returns an empty string unchanged', () => {
    expect(toHiragana('')).toBe('');
  });
});
