# Architecture Map

A structural reference for how this codebase fits together — entities, use cases, ports/adapters, schema, and presentation. This documents **what exists**, not the rules for how to add to it; those rules (layering discipline, testing discipline, coding style, known gotchas) live in [`AGENTS.md`](../AGENTS.md) and are not repeated here.

This is a map, not the source of truth — file paths are given throughout so you can jump to the real code rather than trust this doc as authoritative. It's expected to lag the code slightly; if something here looks wrong, the code wins.

## Overview

A Japanese vocabulary/kanji flashcard app (Expo/React Native + expo-sqlite/Drizzle) built with Clean Architecture: `domain` (pure business logic) → `infrastructure` (concrete adapters implementing domain interfaces) → `composition` (wiring) → `screens`/`components` (presentation). See `AGENTS.md` for the layering rules and the one documented exception (reactive query hooks).

## Domain model (`src/domain/entities/`)

- **`Deck`** — `{ id, name, description, kind, content, createdAt }`. `kind: 'normal'|'memorized'`, `content: 'words'|'kanji'`. A deck holds words *or* kanji, never both. Exactly one memorized deck exists per content type (enforced by a DB constraint, see Schema below).
- **`Word`** — `{ id, deckId, originDeckId, kanji, furigana, englishMeaning, exampleSentenceJp/En, jpToEn, enToJp, createdAt }`. SRS state (`WordReviewState`) is tracked **independently per direction** (`jpToEn` and `enToJp` each have their own box level/streak/due date) — a word can be mastered one way and not the other.
- **`Kanji`** — `{ id, deckId, originDeckId, character, onReadings[], kunReadings[], meanings[], exampleWords[] (0-2), boxLevel, rightStreak, nextDueAt, lastReviewedAt, createdAt }`. Single-direction SRS (unlike `Word`).
- **`Backup`** — versioned snapshot format (`BACKUP_FORMAT_VERSION = 3`; v1 words-only, v2 added kanji/content, v3 added reverse-direction SRS). `BackupSnapshot` holds decks/words/kanji entries.
- **`LLMProvider`** — `'openai'|'anthropic'|'gemini'`, plus per-provider display/cost metadata for Settings.

### SRS algorithm (`src/domain/srs.ts`)

Leitner box system, boxes 1–5. `BOX_INTERVAL_DAYS` (`src/domain/constants.ts`) maps box → days until due: `{1:0, 2:1, 3:3, 4:7, 5:14}`. `applySwipe(current, direction, now)`:
- **left** (don't know) → box resets to 1, streak resets to 0, due immediately.
- **right** (know it) → box +1 (capped at 5), streak +1 (capped at 10); `readyToMemorize = streak >= MEMORIZE_STREAK_THRESHOLD (10)`.

### Kana normalization (`src/domain/kana.ts`)

`toHiragana()` converts katakana readings to hiragana. Dictionaries conventionally give on'yomi in katakana, but this app always stores/displays readings in hiragana since katakana reads as "foreign word" to users — applied when creating kanji and when filling gaps from a dictionary lookup.

## Ports (`src/domain/repositories/*.ts`)

Interfaces the domain depends on; infrastructure implements them.

| Interface | Purpose |
|---|---|
| `DeckRepository` | Deck CRUD (including rename via `update`), `findByName` (case-insensitive, scoped to content type — backs duplicate-name rejection), `getOrCreateMemorized(content)` |
| `WordRepository` | Word CRUD, `getDue`, `updateReviewState`, move/revert memorized |
| `KanjiRepository` | Same shape as `WordRepository`, single-direction |
| `BackupRepository` | `readAll()` / `replaceAll()` (atomic full-DB snapshot restore) |
| `DictionaryLookupService` | Word lookup by query string |
| `ExampleSentenceService` | Example sentence lookup |
| `KanjiDictionaryService` | Kanji readings/meanings/example-word lookup |
| `KanjiPageScanner` / `VocabPageScanner` | Vision-model page scanning → structured entries |

## Use cases (`src/domain/usecases/*.ts`)

One file per feature area, each exporting the operations screens call through the composition root:

- **`deckUseCases`** — create/rename (`updateDeck`) share name validation (trim/length cap) and reject a case-insensitive duplicate name within the same content type (word decks and kanji decks may reuse a name), `getDeck`, delete.
- **`wordUseCases`** — create/update (validates JP example sentence requires an EN translation), delete, get, `getDueWords`, `recordSwipe` (applies SRS, flags `readyToMemorize` only once *both* directions are mastered, plus a one-shot `justMasteredDirection` notice), move/revert memorized.
- **`kanjiUseCases`** — same shape as word use cases, single-direction SRS, hiragana-normalizes readings on create.
- **`backupUseCases`** — `createBackup`/`restoreBackup`; restore does strict validation of untrusted JSON and rejects newer format versions than this app understands.
- **`wordLookupUseCases`** / **`kanjiLookupUseCases`** — dictionary-backed autofill for the add-word/add-kanji forms and scan review screens.
- **`vocabScanUseCases`** / **`kanjiScanUseCases`** — drive a page scan through the vision model and normalize results.

Each has a matching `.test.ts` run against the in-memory fakes in `src/domain/testing/fakes.ts` (extend this file, not a real DB, when adding a new port).

## Infrastructure adapters (`src/infrastructure/`)

- **Repositories** (`repositories/Drizzle*Repository.ts`) — one per domain port, backed by Drizzle over `expo-sqlite`. `DrizzleWordRepository` shares direction-agnostic logic between `jpToEn`/`enToJp` via a column map. `DrizzleBackupRepository.replaceAll()` runs in a transaction and remaps temp IDs to real IDs on restore.
- **Vision models** (`services/vision/`) — `MultiProviderVisionModel` reads the active provider from secure storage and routes to `OpenAiVisionModel` / `AnthropicVisionModel` / `GeminiVisionModel`. Each adapter authors a provider-neutral JSON Schema extraction spec; `GeminiVisionModel`'s `toGeminiSchema()` converts it to Gemini's OpenAPI-subset dialect. HTTP failures funnel through `mapHttpErrorToScanError.ts` into the domain's `ScanErrors` taxonomy (`MissingApiKeyError`, `InvalidApiKeyError`, `RateLimitError`, `ScanUnavailableError`, `ScanFailedError`).
- **External dictionary APIs** — `JishoDictionaryLookupService` (jisho.org), `TatoebaExampleSentenceService` (tatoeba.org), `KanjiApiDictionaryService` (kanjiapi.dev).
- **Secure-store-backed settings** (`services/*Store.ts`) — API keys + active provider (`secureApiKeyStore`), theme preference (`themePreferenceStore`), onboarding-seen flag (`onboardingStore`), all via `expo-secure-store`.
- **`kanjiReadingsMigration.ts`** — one-time backfill converting legacy katakana kanji readings to hiragana, gated by a secure-store flag so it runs once per install.

### The reactive-query exception (`src/infrastructure/queries/*.ts`)

Documented in `AGENTS.md` — the one place infrastructure is imported directly by screens instead of through a port, because these are live SQLite subscriptions. `useWordsInDeck`/`useKanjiInDeck` use Drizzle's `useLiveQuery` directly (their `FROM` table is the one that changes). `useDecksWithCounts` **cannot** use `useLiveQuery` because its item/memorized counts come from correlated subqueries against `words`/`kanji`, and Drizzle's live-query change detection only watches the primary `FROM` table (`decks`). It works around this with a manual `addDatabaseChangeListener`, refetching whenever `decks`, `words`, or `kanji` changes.

## Composition root (`src/composition/container.ts`)

Instantiates every infrastructure singleton and wires it into the matching `create*UseCases` factory, then re-exports the resulting functions flat (`createDeck`, `recordSwipe`, `scanVocabPage`, `restoreBackup`, etc.). **Screens import from here only** — never from `infrastructure/` directly (except the reactive-query hooks above).

## Database schema (`src/infrastructure/db/schema.ts`, Drizzle/SQLite)

- **`decks`** — `id, name, description, kind, content, createdAt`. Partial unique index enforces exactly one `kind='memorized'` deck per `content` value.
- **`words`** — FK `deckId`→decks (cascade delete), `originDeckId`→decks (set null). Mirrored SRS columns for `jpToEn` and the `reverse*` (enToJp) direction. Check constraints: box levels 1–5, streaks 0–10, and JP example sentence requires an EN translation. Indexed on `(deckId, nextDueAt)` and `(deckId, reverseNextDueAt)` for due-list queries.
- **`kanji`** — same FK shape, single-direction SRS columns. `onReadings`/`kunReadings`/`meanings`/`exampleWords` are stored as **JSON text columns**, not child tables — deliberate, since they're display-only and never filtered/joined on.

Migrations live in `drizzle/*.sql`, applied via `drizzle-orm/expo-sqlite/migrator` at app startup (`App.tsx`).

## Presentation layer

- **Screens** (`src/screens/`) — deck list/detail/form, word detail/form, kanji detail, scan-vocab and scan-kanji (camera → vision model → editable review → bulk create), settings (provider/API key, theme, backup export/import), onboarding.
- **`SwipeDeck.tsx`** (`src/components/`) — the shared flashcard gesture engine used for both words and kanji. Pan gesture drives `translateX`/rotation via reanimated; past a threshold (`0.28 * screen width`) the card animates off and `onSwipe` fires; a tap (raced against the pan, not chained) flips the card. A left-swiped (missed) card is requeued 3 positions back rather than to the end, so it resurfaces soon but not immediately.
- **Navigation** (`src/navigation/RootNavigator.tsx`) — native-stack, several screens presented as modals.
- **Theme** (`src/theme/`) — `ThemePreference` (`system`/`light`/`dark`) resolved against the OS scheme, persisted via `themePreferenceStore`, mapped to both app-level tokens and React Navigation's theme.

## Testing approach

- Domain/use-case logic is tested against the in-memory fakes in `src/domain/testing/fakes.ts` — no real database. This is the required pattern for all new use cases (see `AGENTS.md`).
- Infrastructure code that does anything non-trivial in SQL gets a real-database test: `src/infrastructure/repositories/*.diagnostic.test.ts` spin up `better-sqlite3`, replay the actual `drizzle/*.sql` migrations, and exercise the repository against real constraints (FKs, the single-memorized-deck unique index, check constraints) — because a real due-date query bug once slipped past fake-only tests. Follow this pattern for new schema-sensitive queries.
