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

For words, `recordSwipe` only reports `readyToMemorize` once **both** directions have hit the threshold. **Pause rule**: a direction that is mastered while its sibling isn't is excluded from `getDue`. It doesn't come up for review until the other direction catches up, and then pausing stops applying. The rule is enforced in SQL in `DrizzleWordRepository.getDue` and mirrored in the fake.

### Review directions (`src/domain/reviewDirection.ts`)

`otherDirection()`, the `DueCounts` shape (`{ jpToEn, enToJp }`), and `guidanceForEmptyQueue(current, dueCounts)`: once one direction's review queue is empty, it returns either `switchDirection` (the other direction still has words due, with the count) or `allCaughtUp`. The directions are scheduled independently, so finishing one says nothing about the other; this is what lets the review screen point the user at the other direction instead of implying they're done for the day.

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
| `PronunciationService` | Speak Japanese text aloud (`speak(text, 'ja-JP')`) |

## Use cases (`src/domain/usecases/*.ts`)

One file per feature area, each exporting the operations screens call through the composition root:

- **`deckUseCases`** — create/rename (`updateDeck`) share name validation (trim, `DECK_NAME_MAX_LENGTH = 20`) and reject a case-insensitive duplicate name within the same content type (word decks and kanji decks may reuse a name), `getDeck`, delete.
- **`wordUseCases`** — create/update (validates JP example sentence requires an EN translation), delete, get, `getDueWords`, `getDueCounts` (due count per direction, built on the same `getDue` so it always matches what a review session shows, pause rule included), `recordSwipe` (applies SRS, flags `readyToMemorize` only once *both* directions are mastered, plus a one-shot `justMasteredDirection` notice), move/revert memorized.
- **`kanjiUseCases`** — same shape as word use cases, single-direction SRS, hiragana-normalizes readings on create.
- **`backupUseCases`** — `createBackup`/`restoreBackup`; restore does strict validation of untrusted JSON and rejects newer format versions than this app understands.
- **`wordLookupUseCases`** / **`kanjiLookupUseCases`** — dictionary-backed autofill for the add-word/add-kanji forms and scan review screens.
- **`vocabScanUseCases`** / **`kanjiScanUseCases`** — drive a page scan through the vision model and normalize results.
- **`pronunciationUseCases`** — `speakWord` delegates a word's `furigana` to `PronunciationService`. Words only for now; kanji pronunciation (via `onReadings`/`kunReadings`) is a deliberate follow-up, not yet implemented.

Each has a matching `.test.ts` run against the in-memory fakes in `src/domain/testing/fakes.ts` (extend this file, not a real DB, when adding a new port).

## Infrastructure adapters (`src/infrastructure/`)

- **Repositories** (`repositories/Drizzle*Repository.ts`) — `DrizzleDeckRepository`, `DrizzleWordRepository`, `DrizzleKanjiRepository` and `DrizzleBackupRepository`, one per domain port, backed by Drizzle over `expo-sqlite`. `DrizzleWordRepository` shares direction-agnostic logic between `jpToEn`/`enToJp` via a column map. `DrizzleBackupRepository.replaceAll()` runs in a transaction and remaps temp IDs to real IDs on restore.
- **Vision models** (`services/vision/`) — `MultiProviderVisionModel` reads the active provider from secure storage and routes to `OpenAiVisionModel` / `AnthropicVisionModel` / `GeminiVisionModel`, all implementing the `VisionModel` interface (`extract(imageBase64, spec)`). The domain scanner ports are implemented once, provider-independently, by `VisionVocabPageScanner` (`vocabExtraction`) and `VisionKanjiPageScanner` (`kanjiExtraction`). Each defines a `VisionExtractionSpec`: a provider-neutral JSON Schema plus a shared prompt (`vocabExtractionPrompt` / `kanjiExtractionPrompt`), so every provider gets identical instructions. `GeminiVisionModel`'s `toGeminiSchema()` converts it to Gemini's OpenAPI-subset dialect. HTTP failures funnel through `mapHttpErrorToScanError.ts` into the domain's `ScanErrors` taxonomy (`MissingApiKeyError`, `InvalidApiKeyError`, `RateLimitError`, `ScanUnavailableError`, `ScanFailedError`).
- **External dictionary APIs** — `JishoDictionaryLookupService` (jisho.org), `TatoebaExampleSentenceService` (tatoeba.org), `KanjiApiDictionaryService` (kanjiapi.dev).
- **`ExpoSpeechPronunciationService`** — on-device text-to-speech via `expo-speech` (no network call, no API key). Calls `Speech.stop()` before each `Speech.speak()` so overlapping utterances from rapid card swipes don't queue up.
- **Secure-store-backed settings** (`services/*Store.ts`) — API keys + active provider (`secureApiKeyStore`), theme preference (`themePreferenceStore`), onboarding-seen flag (`onboardingStore`), all via `expo-secure-store`.
- **`crashReporting`** — the only module that imports Sentry (`initCrashReporting`, `reportError`). It does nothing unless `EXPO_PUBLIC_SENTRY_DSN` is set, and it's disabled in `__DEV__`.
- **`kanjiReadingsMigration.ts`** — one-time backfill converting legacy katakana kanji readings to hiragana, gated by a secure-store flag so it runs once per install.

### The reactive-query exception (`src/infrastructure/queries/*.ts`)

Documented in `AGENTS.md` — the one place infrastructure is imported directly by screens instead of through a port, because these are live SQLite subscriptions. `useWordsInDeck`/`useKanjiInDeck` use Drizzle's `useLiveQuery` directly (their `FROM` table is the one that changes). `useDecksWithCounts` **cannot** use `useLiveQuery` because its item/memorized counts come from correlated subqueries against `words`/`kanji`, and Drizzle's live-query change detection only watches the primary `FROM` table (`decks`). It works around this with a manual `addDatabaseChangeListener`, refetching whenever `decks`, `words`, or `kanji` changes.

## System flows

How data moves through the layers for the main paths.

**Startup** (`App.tsx`): `initCrashReporting()` → providers (gesture root, keyboard, safe area, `ErrorBoundary`, `ThemeProvider`) → `useMigrations(db, migrations)` applies `drizzle/*.sql` → once migrations succeed, `migrateKanjiReadingsToHiragana()` runs (one-time, flag-gated) → the onboarding flag picks the initial route (`Onboarding` or `DeckList`). A spinner is shown until migrations, theme hydration, the onboarding check and the kanji backfill are all done. A migration error renders an error screen instead of the navigator.

**Review swipe (words)**:
```
SwipeDeck gesture → FlashcardStack.onSwipe → container.recordSwipe(wordId, direction, swipe)
  → wordUseCases: findById → applySwipe (domain/srs) → wordRepository.updateReviewState
  → returns { readyToMemorize, justMasteredDirection }
  → SwipeDeck shows MemorizePrompt or a transient note; onReviewed → useWordReviewSession.refreshDueCounts
  → the write fires the SQLite change listener → useWordsInDeck / useDecksWithCounts re-render
```

**Page scan**:
```
ScanVocabScreen: picker URI → expo-image-manipulator (1600px, JPEG 0.7, base64)
  → container.scanVocabPage(base64) → vocabScanUseCases → VisionVocabPageScanner
  → MultiProviderVisionModel (reads active provider) → OpenAi/Anthropic/GeminiVisionModel (reads its key, HTTP)
  → HTTP errors → mapHttpErrorToScanError → domain ScanErrors → screen-specific alerts
  → editable review rows → createWord per row
```
Kanji scans follow the same path through `scanKanjiPage`. Each result then goes through `fillKanjiGaps` (kanjiapi.dev) before review.

**Backup restore**: Settings reads the picked file → `JSON.parse` → `restoreBackup(raw)` validates the whole snapshot in the domain → `DrizzleBackupRepository.replaceAll` wipes and reinserts inside one transaction, remapping temp IDs.

## Composition root (`src/composition/container.ts`)

Instantiates every infrastructure singleton and wires it into the matching `create*UseCases` factory, then re-exports the resulting functions flat (`createDeck`, `recordSwipe`, `scanVocabPage`, `restoreBackup`, etc.). **Screens import from here** rather than from `infrastructure/`. The exceptions are the reactive-query hooks above and the three secure-store wrappers (`secureApiKeyStore` in `SettingsScreen`, `onboardingStore` in `App.tsx`/`OnboardingScreen`, `themePreferenceStore` in `useTheme`), which have no domain port.

## Database schema (`src/infrastructure/db/schema.ts`, Drizzle/SQLite)

- **`decks`** — `id, name, description, kind, content, createdAt`. Partial unique index enforces exactly one `kind='memorized'` deck per `content` value.
- **`words`** — FK `deckId`→decks (cascade delete), `originDeckId`→decks (set null). Mirrored SRS columns for `jpToEn` and the `reverse*` (enToJp) direction. Check constraints: box levels 1–5, streaks 0–10, and JP example sentence requires an EN translation. Indexed on `(deckId, nextDueAt)` and `(deckId, reverseNextDueAt)` for due-list queries.
- **`kanji`** — same FK shape, single-direction SRS columns. `onReadings`/`kunReadings`/`meanings`/`exampleWords` are stored as **JSON text columns**, not child tables — deliberate, since they're display-only and never filtered/joined on.

Migrations live in `drizzle/*.sql`, applied via `drizzle-orm/expo-sqlite/migrator` at app startup (`App.tsx`).

## Presentation layer

- **Screens** (`src/screens/`), one per route:
  - `DeckListScreen`: Words/Kanji toggle; rename/delete through the ⋮ menu.
  - `DeckDetailScreen`: dispatches to `WordDeckDetailScreen` or `KanjiDeckDetailScreen` by deck content. Each has a list/flashcards mode and a sort cycle.
  - `DeckFormScreen`: create or rename a deck.
  - `WordFormScreen`: add/edit a word, with dictionary lookup.
  - `WordDetailScreen`: read-only view of a memorized word, with revert and pronunciation.
  - `KanjiDetailScreen`: read-only kanji view; actions live in a `HeaderMenu`.
  - `ScanVocabScreen` / `ScanKanjiScreen`: camera → vision model → editable review → bulk create.
  - `SettingsScreen`: provider/API key, theme, backup export/import, review-schedule explainer.
  - `OnboardingScreen`: first-launch slides, replayable from Settings.
- **Other components** (`src/components/`):
  - `KanjiFlashcards`: the kanji counterpart of `FlashcardStack` (single direction).
  - `KanjiDetailBody`: the ordered on/kun/meanings/examples view, shared by the kanji card back and `KanjiDetailScreen`.
  - `MemorizePrompt`: the graduation prompt.
  - `HeaderMenu`: a ⋮ dropdown for header actions.
  - `ErrorBoundary`: the root error boundary that reports to `crashReporting`.
- **`SwipeDeck.tsx`** (`src/components/`) — the shared flashcard gesture engine used for both words and kanji. Pan gesture drives `translateX`/rotation via reanimated; past a threshold (`0.28 * screen width`) the card animates off and `onSwipe` fires; a tap (raced against the pan, not chained) flips the card. A left-swiped (missed) card is requeued 3 positions back rather than to the end, so it resurfaces soon but not immediately. Optional `onSpeak`/`onEdit` render absolutely-positioned buttons outside the `GestureDetector` so they don't fight the pan/tap gesture; `onSpeak` can be restricted to one side of the card via `speakSide` (`FlashcardStack` uses this to show a manual pronunciation button only on the Japanese (front) side during `jpToEn` review — pronunciation is deliberately manual-only and `jpToEn`-only, not auto-played and not offered for `enToJp`).
- **Navigation** (`src/navigation/RootNavigator.tsx`) — native-stack, several screens presented as modals.
- **`FlashcardStack.tsx`** + **`useWordReviewSession`** (`src/hooks/`) — the word review session. The hook owns the review direction, that direction's due queue and both directions' due counts; the deck screen's direction toggle shows those counts (`JP → EN (n)`). Switching direction or re-entering review clears the queue first so `SwipeDeck` remounts with a fresh one (it only seeds its queue on mount), and a request-id guard drops slow responses for a direction the user already left. When the queue empties, `FlashcardStack` uses `guidanceForEmptyQueue` to show how many words are due in the other direction, with a switch button (`SwipeDeck`'s optional `emptyAction`). Display strings for directions live in `src/components/reviewDirectionText.ts`.
- **Theme** (`src/theme/`) — `ThemePreference` (`system`/`light`/`dark`) resolved against the OS scheme, persisted via `themePreferenceStore`, mapped to both app-level tokens and React Navigation's theme.

## Testing approach

- Domain/use-case logic is tested against the in-memory fakes in `src/domain/testing/fakes.ts` — no real database. This is the required pattern for all new use cases (see `AGENTS.md`).
- Infrastructure code that does anything non-trivial in SQL gets a real-database test: `src/infrastructure/repositories/*.diagnostic.test.ts` spin up `better-sqlite3`, replay the actual `drizzle/*.sql` migrations, and exercise the repository against real constraints (FKs, the single-memorized-deck unique index, check constraints) — because a real due-date query bug once slipped past fake-only tests. Follow this pattern for new schema-sensitive queries. `DrizzleWordRepository.diagnostic.test.ts` goes one step further: it `jest.mock`s `db/client` with a `better-sqlite3` Drizzle instance so the real repository class runs, instead of a hand-copied query.
- Presentation hooks with non-trivial state (e.g. `useWordReviewSession`) are tested with `@testing-library/react-native`'s `renderHook`, mocking the composition root. Gesture/animation UI is verified on-device.
