// Shared across every provider adapter so behavior is consistent regardless
// of which one is active. Explicitly instructs the model to return nothing
// rather than force-fitting an answer when the photo isn't a vocab page —
// prompting reduces (but doesn't eliminate) that failure mode; the review
// screen the user sees before saving is the real safety net.
export const VOCAB_EXTRACTION_PROMPT =
  'This is a photo of a Japanese vocabulary list from a textbook page. Extract every vocabulary entry you can read. ' +
  'For each entry, provide: kanji (the kanji/written form if the entry has one, otherwise null), furigana (the kana reading — always required), ' +
  'and englishMeaning (the English definition given on the page). Skip section headers, page numbers, grammar notes, and anything that is not an actual vocabulary entry. ' +
  'If this photo does not show a Japanese vocabulary list at all, return an empty list of words rather than guessing.';
