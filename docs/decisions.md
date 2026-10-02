# Technical Decisions

## Clean Architecture with a single composition root

**Decision**: Business rules live in `src/domain` as pure TypeScript behind repository/service interfaces. Infrastructure implements those interfaces, and `src/composition/container.ts` wires them together.

**Why**: The rules that matter most are the SRS ladder, the two-direction mastery and pause logic, and backup validation. All of them can be tested in milliseconds against `src/domain/testing/fakes.ts`, with no device or database. Swapping a provider only touches one adapter plus one line in the container. Adding Gemini next to OpenAI and Anthropic worked this way.

**Trade-off**: There's more ceremony per feature: a port, a fake, a use case, an adapter and the wiring. It's accepted because the codebase is small enough that the extra files cost less than untested logic in screens.

## Reactive queries bypass the repository layer

**Decision**: `src/infrastructure/queries/*` are React hooks that query Drizzle directly. Screens import them, which breaks the "screens only import the container" rule.

**Why**: Live updates are a property of the SQLite change listener, so there's no persistence-neutral way to express them as a port without inventing a whole reactive read-model. The exception is read-only, and all writes still go through use cases.

**Gotcha this created**: `useLiveQuery` only watches the query's `FROM` table. The deck list counts words and kanji through subqueries, so `useDecksWithCounts` subscribes with `addDatabaseChangeListener` to `decks`, `words` and `kanji` by hand and refetches.

## Leitner boxes instead of SM-2/FSRS

**Decision**: There are five boxes with fixed intervals of 0/1/3/7/14 days (`BOX_INTERVAL_DAYS`). A right swipe moves a card up one box. A left swipe sends it back to box 1, due again the same day.

**Why**: A binary know/don't-know swipe gives no grade to feed an ease factor. Fixed boxes are also easy to explain: Settings renders the exact table from `reviewScheduleSteps()`.

**Discarded**: Ease-based algorithms. They would need a graded answer UI, which conflicts with the swipe interaction.

## SRS tracked independently per review direction

**Decision**: Each word stores two full SRS states, `jpToEn` and `enToJp`, in mirrored columns (`boxLevel…` / `reverseBoxLevel…`). Kanji keep a single state.

**Why**: Recognising a word and producing it are different skills, and a shared state would let one hide gaps in the other.

**Consequences**:
- A word only becomes ready to memorize when **both** directions reach the 10-right streak.
- **Pause rule**: once one direction is mastered and the other isn't, the mastered direction stops coming up in `getDue` until its sibling catches up. Reviews go where they're needed. The rule is enforced in SQL (`DrizzleWordRepository.getDue`) and mirrored in the fake.
- `getDueCounts` reuses `getDue` instead of a separate `COUNT` query, so the counts on the direction toggle always match what a session shows, pause rule included.
- The backup format went to v3 to carry `reverseSrs`. v1 and v2 files still restore, with fresh reverse state.

**Why mirrored columns and not a child table**: There are exactly two directions, and both are always read together.

## JSON columns for kanji readings and meanings

**Decision**: `onReadings`, `kunReadings`, `meanings` and `exampleWords` are JSON text columns on `kanji`.

**Why**: They're only ever displayed, never filtered or joined on. Child tables would add joins and migration work for no query benefit.

## Readings normalised to hiragana

**Decision**: `toHiragana()` is applied at creation (`kanjiUseCases.normalize`), when filling gaps from the dictionary (`kanjiLookupUseCases`), and once to legacy data (`kanjiReadingsMigration`).

**Why**: Dictionaries give on'yomi in katakana, which learners read as "loanword". Normalising at every entry point means display code never has to care where the data came from.

## Bring-your-own-key, on-device vision scanning

**Decision**: There's no backend. Users pick OpenAI, Anthropic or Gemini in Settings and paste their own key. The key is stored with `expo-secure-store` and sent straight from the phone to that provider.

**Why**: The app needs no server to run or pay for, user keys are never held centrally, and the app works fully offline apart from scanning and lookups.

**Supporting choices**:
- `MultiProviderVisionModel` resolves the active provider on each call, so switching in Settings takes effect immediately.
- Each extraction is written once as a provider-neutral JSON Schema. `toGeminiSchema()` translates it to Gemini's OpenAPI subset, instead of keeping three hand-written schemas.
- `mapHttpErrorToScanError` maps every provider's HTTP failures onto one domain taxonomy (missing/invalid key, rate limit, unavailable, failed). Screens can then show a "Go to Settings" action without knowing which provider failed.
- Photos are resized to 1600px wide and re-encoded as JPEG (quality 0.7) **before** base64 encoding. Requesting base64 straight from the picker on a 12MP+ photo produced 20–40 MB strings and crashed the app.
- The image library is opened with the system photo picker and no library permission is requested. `RECORD_AUDIO` is blocked in `app.json`.

## Restore is strict and all-or-nothing

**Decision**: `restoreBackup` validates the whole untrusted JSON (types, deck references, at most one Memorized deck, a supported `formatVersion`) **before** `DrizzleBackupRepository.replaceAll` wipes and rewrites the database in a single transaction.

**Why**: A restore replaces the user's whole library, so a malformed file must fail before anything is deleted. A backup from a newer app version is rejected rather than half-understood.

## One Memorized deck per content type, enforced in the database

**Decision**: A partial unique index on `decks(content) WHERE kind = 'memorized'`. `getOrCreateMemorized(content)` creates the deck lazily.

**Why**: The invariant holds even under concurrent creation or a crafted backup. Graduated cards keep `originDeckId` (`ON DELETE SET NULL`) so they can be reverted, and the domain gives a clear error when the origin deck no longer exists.

## Pronunciation is manual and JP → EN only

**Decision**: `expo-speech` runs on the device (no key, no network). The speak button only appears on the Japanese front of a `jpToEn` card and on the word detail screen. Nothing plays automatically.

**Why**: In EN → JP review, speaking the Japanese would give away the answer. Auto-play during fast swipes would also be noisy, and `Speech.stop()` before every `speak()` stops utterances from queueing up. Kanji pronunciation hasn't been built yet.

## Pinned to Expo SDK 54

**Decision**: `expo` is pinned to `54`, and `userInterfaceStyle` stays `"automatic"`.

**Why**: Store-distributed Expo Go only supports SDK 54. An earlier upgrade broke on-device testing without a custom dev build. A hard-coded `userInterfaceStyle` forces one appearance at the native level and silently overrides the JS theme preference (system/light/dark).

## Crash reporting behind an interface

**Decision**: Only `crashReporting.ts` imports Sentry. The DSN comes from `EXPO_PUBLIC_SENTRY_DSN`, and reporting is turned off in `__DEV__` with performance tracing at 0.

**Why**: The repo stays provider-agnostic. Local runs report nothing, and swapping Sentry would only touch one file.
