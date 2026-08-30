import type { Deck } from '../entities/Deck';
import type { DeckRepository } from '../repositories/DeckRepository';
import type { Word, WordInput } from '../entities/Word';
import type { Kanji, KanjiInput } from '../entities/Kanji';
import type { ReviewState, WordRepository } from '../repositories/WordRepository';
import type { KanjiRepository } from '../repositories/KanjiRepository';
import type { KanjiPageScanner, ScannedKanji } from '../repositories/KanjiPageScanner';
import type { KanjiDictionaryEntry, KanjiDictionaryService } from '../repositories/KanjiDictionaryService';
import type { BackupRepository, RestoreDeck, RestoreKanji, RestoreWord } from '../repositories/BackupRepository';
import { MEMORIZED_DECK_NAME, MEMORIZED_KANJI_DECK_NAME } from '../constants';

// In-memory stand-ins for DeckRepository/WordRepository, used only in tests.
// They exist because the domain/use-case layer depends on these interfaces,
// not on Drizzle/SQLite — so tests can exercise business rules without a
// database at all.

export function createFakeDeckRepository(seed: Deck[] = []): DeckRepository {
  const decks: Deck[] = [...seed];
  let nextId = decks.reduce((max, d) => Math.max(max, d.id), 0) + 1;

  return {
    async create(input) {
      const deck: Deck = {
        id: nextId++,
        name: input.name,
        description: input.description,
        kind: 'normal',
        content: input.content,
        createdAt: new Date(),
      };
      decks.push(deck);
      return deck;
    },
    async delete(id) {
      const index = decks.findIndex((d) => d.id === id);
      if (index !== -1) decks.splice(index, 1);
    },
    async findById(id) {
      return decks.find((d) => d.id === id) ?? null;
    },
    async getMemorized(content) {
      return decks.find((d) => d.kind === 'memorized' && d.content === content) ?? null;
    },
    async getOrCreateMemorized(content) {
      const existing = decks.find((d) => d.kind === 'memorized' && d.content === content);
      if (existing) return existing;
      const deck: Deck = {
        id: nextId++,
        name: content === 'kanji' ? MEMORIZED_KANJI_DECK_NAME : MEMORIZED_DECK_NAME,
        description: null,
        kind: 'memorized',
        content,
        createdAt: new Date(),
      };
      decks.push(deck);
      return deck;
    },
  };
}

function toWordRow(id: number, input: WordInput): Word {
  return {
    id,
    deckId: input.deckId,
    originDeckId: null,
    kanji: input.kanji ?? null,
    furigana: input.furigana,
    englishMeaning: input.englishMeaning,
    exampleSentenceJp: input.exampleSentenceJp ?? null,
    exampleSentenceEn: input.exampleSentenceEn ?? null,
    boxLevel: 1,
    rightStreak: 0,
    nextDueAt: new Date(),
    lastReviewedAt: null,
    createdAt: new Date(),
  };
}

export function createFakeWordRepository(seed: Word[] = []): WordRepository {
  const words: Word[] = [...seed];
  let nextId = words.reduce((max, w) => Math.max(max, w.id), 0) + 1;

  function getOrThrow(id: number): Word {
    const word = words.find((w) => w.id === id);
    if (!word) throw new Error(`Word ${id} not found`);
    return word;
  }

  return {
    async create(input) {
      const word = toWordRow(nextId++, input);
      words.push(word);
      return word;
    },
    async update(id, input) {
      const word = getOrThrow(id);
      Object.assign(word, {
        kanji: input.kanji ?? null,
        furigana: input.furigana,
        englishMeaning: input.englishMeaning,
        exampleSentenceJp: input.exampleSentenceJp ?? null,
        exampleSentenceEn: input.exampleSentenceEn ?? null,
      });
      return word;
    },
    async delete(id) {
      const index = words.findIndex((w) => w.id === id);
      if (index !== -1) words.splice(index, 1);
    },
    async findById(id) {
      return words.find((w) => w.id === id) ?? null;
    },
    async getDue(deckId, now) {
      return words.filter((w) => w.deckId === deckId && w.nextDueAt <= now);
    },
    async updateReviewState(id, state: ReviewState) {
      const word = getOrThrow(id);
      Object.assign(word, state);
      return word;
    },
    async moveToMemorized(id, memorizedDeckId, originDeckId) {
      const word = getOrThrow(id);
      word.deckId = memorizedDeckId;
      word.originDeckId = originDeckId;
      return word;
    },
    async revertFromMemorized(id, originDeckId) {
      const word = getOrThrow(id);
      word.deckId = originDeckId;
      word.originDeckId = null;
      word.boxLevel = 1;
      word.rightStreak = 0;
      word.nextDueAt = new Date();
      return word;
    },
  };
}

function toKanjiRow(id: number, input: KanjiInput): Kanji {
  return {
    id,
    deckId: input.deckId,
    originDeckId: null,
    character: input.character,
    onReadings: [...input.onReadings],
    kunReadings: [...input.kunReadings],
    meanings: [...input.meanings],
    exampleWords: input.exampleWords.map((word) => ({ ...word })),
    boxLevel: 1,
    rightStreak: 0,
    nextDueAt: new Date(),
    lastReviewedAt: null,
    createdAt: new Date(),
  };
}

export function createFakeKanjiRepository(seed: Kanji[] = []): KanjiRepository {
  const entries: Kanji[] = [...seed];
  let nextId = entries.reduce((max, k) => Math.max(max, k.id), 0) + 1;

  function getOrThrow(id: number): Kanji {
    const kanji = entries.find((k) => k.id === id);
    if (!kanji) throw new Error(`Kanji ${id} not found`);
    return kanji;
  }

  return {
    async create(input) {
      const kanji = toKanjiRow(nextId++, input);
      entries.push(kanji);
      return kanji;
    },
    async delete(id) {
      const index = entries.findIndex((k) => k.id === id);
      if (index !== -1) entries.splice(index, 1);
    },
    async findById(id) {
      return entries.find((k) => k.id === id) ?? null;
    },
    async getDue(deckId, now) {
      return entries.filter((k) => k.deckId === deckId && k.nextDueAt <= now);
    },
    async updateReviewState(id, state: ReviewState) {
      const kanji = getOrThrow(id);
      Object.assign(kanji, state);
      return kanji;
    },
    async moveToMemorized(id, memorizedDeckId, originDeckId) {
      const kanji = getOrThrow(id);
      kanji.deckId = memorizedDeckId;
      kanji.originDeckId = originDeckId;
      return kanji;
    },
    async revertFromMemorized(id, originDeckId) {
      const kanji = getOrThrow(id);
      kanji.deckId = originDeckId;
      kanji.originDeckId = null;
      kanji.boxLevel = 1;
      kanji.rightStreak = 0;
      kanji.nextDueAt = new Date();
      return kanji;
    },
  };
}

export function createFakeKanjiPageScanner(result: ScannedKanji[] = []): KanjiPageScanner {
  return {
    async scanKanjiPage() {
      return result.map((kanji) => ({ ...kanji }));
    },
  };
}

export function createFakeKanjiDictionaryService(
  entriesByCharacter: Record<string, KanjiDictionaryEntry> = {},
): KanjiDictionaryService {
  return {
    async lookup(character) {
      return entriesByCharacter[character] ?? null;
    },
  };
}

export function createFakeBackupRepository(
  seed: { decks?: Deck[]; words?: Word[]; kanji?: Kanji[] } = {},
): BackupRepository {
  let decks: Deck[] = [...(seed.decks ?? [])];
  let words: Word[] = [...(seed.words ?? [])];
  let kanji: Kanji[] = [...(seed.kanji ?? [])];

  return {
    async readAll() {
      return { decks: [...decks], words: [...words], kanji: [...kanji] };
    },
    async replaceAll(restoreDecks: RestoreDeck[], restoreWords: RestoreWord[], restoreKanji: RestoreKanji[]) {
      const idByTempId = new Map<number, number>();
      decks = restoreDecks.map((deck, index) => {
        const id = index + 1;
        idByTempId.set(deck.tempId, id);
        return {
          id,
          name: deck.name,
          description: deck.description,
          kind: deck.kind,
          content: deck.content,
          createdAt: new Date(),
        };
      });

      const mapDeckId = (tempId: number, label: string): number => {
        const id = idByTempId.get(tempId);
        if (id === undefined) throw new Error(`Fake restore: ${label} points to unknown deck ${tempId}`);
        return id;
      };
      const mapOriginDeckId = (tempId: number | null): number | null =>
        tempId !== null ? idByTempId.get(tempId) ?? null : null;

      words = restoreWords.map((word, index) => ({
        id: index + 1,
        deckId: mapDeckId(word.tempDeckId, 'word'),
        originDeckId: mapOriginDeckId(word.tempOriginDeckId),
        kanji: word.kanji,
        furigana: word.furigana,
        englishMeaning: word.englishMeaning,
        exampleSentenceJp: word.exampleSentenceJp,
        exampleSentenceEn: word.exampleSentenceEn,
        boxLevel: word.boxLevel,
        rightStreak: word.rightStreak,
        nextDueAt: word.nextDueAt,
        lastReviewedAt: word.lastReviewedAt,
        createdAt: new Date(),
      }));

      kanji = restoreKanji.map((entry, index) => ({
        id: index + 1,
        deckId: mapDeckId(entry.tempDeckId, 'kanji'),
        originDeckId: mapOriginDeckId(entry.tempOriginDeckId),
        character: entry.character,
        onReadings: [...entry.onReadings],
        kunReadings: [...entry.kunReadings],
        meanings: [...entry.meanings],
        exampleWords: entry.exampleWords.map((word) => ({ ...word })),
        boxLevel: entry.boxLevel,
        rightStreak: entry.rightStreak,
        nextDueAt: entry.nextDueAt,
        lastReviewedAt: entry.lastReviewedAt,
        createdAt: new Date(),
      }));
    },
  };
}
