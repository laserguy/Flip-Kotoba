import type { DeckContent, DeckKind } from '../entities/Deck';
import type {
  BackupRepository,
  RestoreDeck,
  RestoreKanji,
  RestoreWord,
} from '../repositories/BackupRepository';
import {
  BACKUP_FORMAT_VERSION,
  type BackupDeckEntry,
  type BackupKanjiEntry,
  type BackupSnapshot,
  type BackupSrsState,
  type BackupWordEntry,
} from '../entities/Backup';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Backup file is invalid: "${field}" is missing or not text.`);
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`Backup file is invalid: "${field}" must be text or empty.`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Backup file is invalid: "${field}" is missing or not a number.`);
  }
  return value;
}

function toStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Backup file is invalid: "${field}" must be a list.`);
  return value.map((item, index) => requireString(item, `${field}[${index}]`));
}

function toExampleWordList(value: unknown, field: string): { japanese: string; english: string }[] {
  if (!Array.isArray(value)) throw new Error(`Backup file is invalid: "${field}" must be a list.`);
  return value.map((item, index) => {
    if (!isPlainObject(item)) throw new Error(`Backup file is invalid: "${field}[${index}]" is malformed.`);
    return {
      japanese: requireString(item.japanese, `${field}[${index}].japanese`),
      english: requireString(item.english, `${field}[${index}].english`),
    };
  });
}

function parseSrs(value: unknown, field: string): BackupSrsState | null {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new Error(`Backup file is invalid: "${field}" is malformed.`);
  return {
    boxLevel: requireNumber(value.boxLevel, `${field}.boxLevel`),
    rightStreak: requireNumber(value.rightStreak, `${field}.rightStreak`),
    nextDueAt: requireString(value.nextDueAt, `${field}.nextDueAt`),
    lastReviewedAt: requireNullableString(value.lastReviewedAt, `${field}.lastReviewedAt`),
  };
}

// Turns untrusted JSON (already parsed) into a BackupSnapshot, or throws a
// message suitable for showing the user. Kept strict on purpose — a restore
// wipes the current library, so a malformed file must fail before that happens.
function parseSnapshot(raw: unknown): BackupSnapshot {
  if (!isPlainObject(raw)) throw new Error("That file isn't a Flip Kotoba backup.");

  const formatVersion = requireNumber(raw.formatVersion, 'formatVersion');
  if (formatVersion < 1 || formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was made by a newer version of the app and cannot be restored here.');
  }

  if (!Array.isArray(raw.decks)) throw new Error('Backup file is invalid: no decks list.');
  if (!Array.isArray(raw.words)) throw new Error('Backup file is invalid: no words list.');

  const decks = raw.decks.map((entry, index): BackupDeckEntry => {
    if (!isPlainObject(entry)) throw new Error(`Backup file is invalid: deck #${index + 1} is malformed.`);
    if (entry.kind !== 'normal' && entry.kind !== 'memorized') {
      throw new Error(`Backup file is invalid: deck #${index + 1} has an unknown kind.`);
    }
    const kind: DeckKind = entry.kind;
    // Format v1 files have no `content` — treat those decks as word decks.
    if (entry.content !== undefined && entry.content !== 'words' && entry.content !== 'kanji') {
      throw new Error(`Backup file is invalid: deck #${index + 1} has an unknown content type.`);
    }
    const content: DeckContent = entry.content === 'kanji' ? 'kanji' : 'words';
    return {
      id: requireNumber(entry.id, `decks[${index}].id`),
      name: requireString(entry.name, `decks[${index}].name`),
      description: requireNullableString(entry.description, `decks[${index}].description`),
      kind,
      content,
    };
  });

  if (decks.filter((deck) => deck.kind === 'memorized').length > 1) {
    throw new Error('Backup file is invalid: it has more than one Memorized deck.');
  }

  const deckIds = new Set(decks.map((deck) => deck.id));
  const resolveOriginDeckId = (originDeckId: number | null): number | null =>
    originDeckId !== null && deckIds.has(originDeckId) ? originDeckId : null;

  const words = raw.words.map((entry, index): BackupWordEntry => {
    if (!isPlainObject(entry)) throw new Error(`Backup file is invalid: word #${index + 1} is malformed.`);
    const deckId = requireNumber(entry.deckId, `words[${index}].deckId`);
    if (!deckIds.has(deckId)) {
      throw new Error(`Backup file is invalid: word #${index + 1} belongs to a deck that isn't in the file.`);
    }
    const originDeckId = entry.originDeckId === null ? null : requireNumber(entry.originDeckId, `words[${index}].originDeckId`);

    return {
      deckId,
      // An origin deck that's no longer in the file just means the word can't be
      // reverted later — same as when its origin deck was deleted in the app.
      originDeckId: resolveOriginDeckId(originDeckId),
      kanji: requireNullableString(entry.kanji, `words[${index}].kanji`),
      furigana: requireString(entry.furigana, `words[${index}].furigana`),
      englishMeaning: requireString(entry.englishMeaning, `words[${index}].englishMeaning`),
      exampleSentenceJp: requireNullableString(entry.exampleSentenceJp, `words[${index}].exampleSentenceJp`),
      exampleSentenceEn: requireNullableString(entry.exampleSentenceEn, `words[${index}].exampleSentenceEn`),
      srs: parseSrs(entry.srs, `words[${index}].srs`),
      reverseSrs: parseSrs(entry.reverseSrs, `words[${index}].reverseSrs`),
    };
  });

  // `kanji` is absent from v1 files.
  const rawKanji = raw.kanji === undefined ? [] : raw.kanji;
  if (!Array.isArray(rawKanji)) throw new Error('Backup file is invalid: the kanji list is malformed.');

  const kanji = rawKanji.map((entry, index): BackupKanjiEntry => {
    if (!isPlainObject(entry)) throw new Error(`Backup file is invalid: kanji #${index + 1} is malformed.`);
    const deckId = requireNumber(entry.deckId, `kanji[${index}].deckId`);
    if (!deckIds.has(deckId)) {
      throw new Error(`Backup file is invalid: kanji #${index + 1} belongs to a deck that isn't in the file.`);
    }
    const originDeckId = entry.originDeckId === null ? null : requireNumber(entry.originDeckId, `kanji[${index}].originDeckId`);

    return {
      deckId,
      originDeckId: resolveOriginDeckId(originDeckId),
      character: requireString(entry.character, `kanji[${index}].character`),
      onReadings: toStringList(entry.onReadings, `kanji[${index}].onReadings`),
      kunReadings: toStringList(entry.kunReadings, `kanji[${index}].kunReadings`),
      meanings: toStringList(entry.meanings, `kanji[${index}].meanings`),
      exampleWords: toExampleWordList(entry.exampleWords, `kanji[${index}].exampleWords`),
      srs: parseSrs(entry.srs, `kanji[${index}].srs`),
    };
  });

  return {
    formatVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    includesSrsProgress: raw.includesSrsProgress === true,
    decks,
    words,
    kanji,
  };
}

function parseIsoDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Backup file is invalid: a date could not be read.');
  return date;
}

function toIsoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function srsFieldsFrom(srs: BackupSrsState | null) {
  return {
    boxLevel: srs ? srs.boxLevel : 1,
    rightStreak: srs ? srs.rightStreak : 0,
    nextDueAt: srs ? parseIsoDate(srs.nextDueAt) : new Date(),
    lastReviewedAt: srs && srs.lastReviewedAt ? parseIsoDate(srs.lastReviewedAt) : null,
  };
}

function reverseSrsFieldsFrom(srs: BackupSrsState | null) {
  const fields = srsFieldsFrom(srs);
  return {
    reverseBoxLevel: fields.boxLevel,
    reverseRightStreak: fields.rightStreak,
    reverseNextDueAt: fields.nextDueAt,
    reverseLastReviewedAt: fields.lastReviewedAt,
  };
}

export function createBackupUseCases(backupRepository: BackupRepository) {
  return {
    createBackup: async (options: { includeSrsProgress: boolean }): Promise<BackupSnapshot> => {
      const { decks, words, kanji } = await backupRepository.readAll();

      const srsFor = (item: { boxLevel: number; rightStreak: number; nextDueAt: Date; lastReviewedAt: Date | null }) =>
        options.includeSrsProgress
          ? {
              boxLevel: item.boxLevel,
              rightStreak: item.rightStreak,
              nextDueAt: item.nextDueAt.toISOString(),
              lastReviewedAt: toIsoOrNull(item.lastReviewedAt),
            }
          : null;

      return {
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        includesSrsProgress: options.includeSrsProgress,
        decks: decks.map((deck) => ({
          id: deck.id,
          name: deck.name,
          description: deck.description,
          kind: deck.kind,
          content: deck.content,
        })),
        words: words.map((word) => ({
          deckId: word.deckId,
          originDeckId: word.originDeckId,
          kanji: word.kanji,
          furigana: word.furigana,
          englishMeaning: word.englishMeaning,
          exampleSentenceJp: word.exampleSentenceJp,
          exampleSentenceEn: word.exampleSentenceEn,
          srs: srsFor(word.jpToEn),
          reverseSrs: srsFor(word.enToJp),
        })),
        kanji: kanji.map((entry) => ({
          deckId: entry.deckId,
          originDeckId: entry.originDeckId,
          character: entry.character,
          onReadings: entry.onReadings,
          kunReadings: entry.kunReadings,
          meanings: entry.meanings,
          exampleWords: entry.exampleWords,
          srs: srsFor(entry),
        })),
      };
    },

    restoreBackup: async (
      raw: unknown,
    ): Promise<{ deckCount: number; wordCount: number; kanjiCount: number }> => {
      const snapshot = parseSnapshot(raw);

      const restoreDecks: RestoreDeck[] = snapshot.decks.map((deck) => ({
        tempId: deck.id,
        name: deck.name,
        description: deck.description,
        kind: deck.kind,
        content: deck.content ?? 'words',
      }));

      const restoreWords: RestoreWord[] = snapshot.words.map((word) => ({
        tempDeckId: word.deckId,
        tempOriginDeckId: word.originDeckId,
        kanji: word.kanji,
        furigana: word.furigana,
        englishMeaning: word.englishMeaning,
        exampleSentenceJp: word.exampleSentenceJp,
        exampleSentenceEn: word.exampleSentenceEn,
        ...srsFieldsFrom(word.srs),
        ...reverseSrsFieldsFrom(word.reverseSrs ?? null),
      }));

      const restoreKanji: RestoreKanji[] = snapshot.kanji.map((entry) => ({
        tempDeckId: entry.deckId,
        tempOriginDeckId: entry.originDeckId,
        character: entry.character,
        onReadings: entry.onReadings,
        kunReadings: entry.kunReadings,
        meanings: entry.meanings,
        exampleWords: entry.exampleWords,
        ...srsFieldsFrom(entry.srs),
      }));

      await backupRepository.replaceAll(restoreDecks, restoreWords, restoreKanji);
      return {
        deckCount: restoreDecks.length,
        wordCount: restoreWords.length,
        kanjiCount: restoreKanji.length,
      };
    },
  };
}

export type BackupUseCases = ReturnType<typeof createBackupUseCases>;
