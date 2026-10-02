# Testing

## Running tests

```bash
npm test            # Jest, jest-expo preset
npx tsc --noEmit    # type check — run both before calling a change done
```

Run a single file or pattern:

```bash
npx jest src/domain/usecases/wordUseCases.test.ts
npx jest diagnostic
```

`src/domain/testing/` is excluded from Jest's test paths (`testPathIgnorePatterns` in `package.json`). It holds the shared fakes, not tests.

## What is covered

### 1. Domain unit tests: the core of the suite

These are co-located `*.test.ts` files next to the code they test in `src/domain/`:

| Area | Files |
|---|---|
| SRS ladder | `srs.test.ts` |
| Review-direction guidance | `reviewDirection.test.ts` |
| Kana normalisation | `kana.test.ts` |
| Use cases | `usecases/{deck,word,kanji,backup,wordLookup,kanjiLookup,vocabScan,kanjiScan,pronunciation}UseCases.test.ts` |

Each test builds the use case against the in-memory implementations in `src/domain/testing/fakes.ts`. There's no SQLite, no network and no React Native. The fakes reproduce repository semantics the use cases depend on, for example the per-direction pause rule in the fake `getDue`.

**Rule**: new domain logic comes with a test in the same change. A new port gets a fake added to `fakes.ts` rather than a test that hits a real database.

### 2. Real-database diagnostic tests: schema-sensitive infrastructure

These are the `src/infrastructure/repositories/*.diagnostic.test.ts` files. Each one opens an in-memory **better-sqlite3** database, replays the real `drizzle/*.sql` migrations, and runs queries against the actual constraints (foreign keys, the single-Memorized-deck partial unique index, check constraints).

| File | Guards against |
|---|---|
| `getDue.diagnostic.test.ts` | Due-date comparison bugs and the pause rule in SQL. It was written after a real bug got past the fake-only tests |
| `DrizzleWordRepository.diagnostic.test.ts` | `jest.mock`s `db/client` with a better-sqlite3 Drizzle instance, so the **real repository class** runs, not a copy of its query |
| `backupRestore.diagnostic.test.ts` | Transactional `replaceAll`, temp-id → real-id remapping |
| `kanjiReadingsMigration.diagnostic.test.ts` | The one-time katakana → hiragana backfill |

Write one of these whenever a query does anything non-trivial (joins, subqueries, aggregates, multi-column conditions).

### 3. Infrastructure pure-function tests

- `services/mapHttpErrorToScanError.test.ts`: maps HTTP status codes to the domain scan errors.
- `services/vision/toGeminiSchema.test.ts`: converts JSON Schema to Gemini's schema dialect.

### 4. Presentation logic

- `src/hooks/useWordReviewSession.test.ts` uses `@testing-library/react-native`'s `renderHook` and mocks `composition/container`. It covers switching direction, clearing the queue on re-entry, and dropping stale responses through the request-id guard.
- `src/components/reviewDirectionText.test.ts` tests the display strings.

### 5. Documentation drift

`docs/docs.test.ts` checks the docs against the code. It fails when:

| Check | Fails when |
|---|---|
| Module inventory | A non-test module under `src/domain`, `src/infrastructure`, `src/screens`, `src/hooks` or `src/components` isn't named in `ARCHITECTURE.md` |
| Tables | A Drizzle table in `schema.ts` isn't listed (in backticks) in `ARCHITECTURE.md` |
| Paths | A backticked path under `src/`, `drizzle/` or `docs/`, or a relative Markdown link, in `README.md`, `AGENTS.md` or `docs/*.md` points at nothing (globs must match at least one file) |
| Constants | A doc quotes a domain constant whose current value is different. The table of quoted facts is in the test |
| Scripts | A doc mentions `npm run <x>` and `<x>` isn't in `package.json` |

Each failure names the doc and the missing term, so the fix is to edit the doc. If a doc stops quoting a constant on purpose, remove that entry from the test's `quotedFacts`. The test checks names and numbers only, so it can't tell whether an explanation is still correct.

### Not covered by automated tests

- Gesture and animation behaviour (`SwipeDeck`), screen layouts, camera/picker flows and text-to-speech. These are verified by hand on a device through Expo Go, because the web preview can't run expo-sqlite.
- HTTP adapters (`OpenAiVisionModel`, `JishoDictionaryLookupService`, …) aren't tested against live APIs.

## Coverage

There's no coverage threshold or `collectCoverage` setting. To get a one-off report:

```bash
npx jest --coverage
```
