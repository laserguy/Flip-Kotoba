# FlashCards App — Agent Instructions

## Stack
- Expo SDK 54 (React Native), TypeScript. Read versioned docs at https://docs.expo.dev/versions/v54.0.0/ before relying on API behavior — do not assume the latest docs apply.
- **Do not upgrade the Expo SDK without checking Expo Go's currently-supported version first.** The Expo Go app from the Play/App Store is frozen at SDK 54 as of when this was written (Google/Apple no longer ship every SDK release to the store apps). Upgrading past what Expo Go supports breaks `npx expo start` testing on a real device without a custom dev build. This already happened once in this project's history — don't rediscover it.
- expo-sqlite + Drizzle ORM for local persistent storage
- React Navigation (native-stack)
- react-native-reanimated + react-native-gesture-handler for the flashcard swipe/flip
- expo-secure-store for API keys and small preference flags
- expo-image-picker + expo-image-manipulator for the vocab-page scan feature
- Jest (jest-expo preset) for tests — `npm test`

## Coding principles — standing defaults, not opt-in

This project follows Robert C. Martin's Clean Code and Clean Architecture, **plus a standing testing discipline**, by default on every change — not just when explicitly requested. All three are equally binding, not just the layering.

### Clean Architecture (layering)
- `src/domain/` — entities, repository *interfaces* (ports), use cases, and pure business rules (SRS box/interval logic, validation, the scan error taxonomy). Zero dependency on React, React Native, Drizzle, or any infrastructure — testable without a database or device.
- `src/infrastructure/` — concrete implementations of the domain's repository interfaces: Drizzle repositories, secure key storage, the OpenAI/Anthropic/Gemini vision adapters, the Jisho/Tatoeba dictionary lookups. This is the only layer allowed to import Drizzle, expo-sqlite, or make HTTP calls.
- `src/composition/container.ts` — the single composition root: wires concrete infrastructure into domain interfaces, exports ready-to-use functions. Screens import from here, never from infrastructure directly.
- `src/screens/`, `src/components/`, `src/navigation/`, `src/theme/` — presentation layer. Depends on composition + domain types only.
- **One deliberate, documented exception**: `src/infrastructure/queries/*.ts` (`useDecksWithCounts`, `useWordsInDeck`) are live-updating React hooks that talk to Drizzle directly instead of through a repository. Reactive SQLite subscriptions are inherently tied to this specific persistence tech, and there's no other reactive read-model to route them through without inventing one. Mutations always go through the use-case layer regardless — this is a read-only exception, called out inline in those files. If a new reactive-query need comes up, follow the same pattern rather than letting Drizzle leak into screens directly.

### Clean Code (micro-level, every file, not just the domain layer)
- Meaningful, intention-revealing names — no abbreviations that aren't obvious, no `data`/`temp`/`x`-style placeholders.
- Small, single-responsibility functions. If a function is doing two things ("normalize the input" and "save it"), split it, even in screen code.
- Comments explain *why*, not *what* — the code should read clearly enough that a comment restating it is unnecessary. Reserve comments for non-obvious business rules or a deliberate workaround (see the gotchas below for examples of the kind of thing worth a comment).
- No dead code, no commented-out old versions, no speculative "might need this later" abstraction — this codebase has repeatedly favored deleting/simplifying over accumulating unused flexibility.
- Prefer clarity over cleverness — this applies to hooks and gesture/animation code too, not just plain business logic.

### Testing discipline
- **New domain/use-case logic gets a unit test as part of the same change, not as a follow-up.** Test against an in-memory fake (see `src/domain/testing/fakes.ts` — extend it for new repository interfaces rather than hitting a real database), not a live SQLite connection. This has been the pattern for every use case added so far (SRS, deck/word CRUD, dictionary lookup, vocab scanning, error mapping) — don't regress it for the next one.
- Bug fixes in domain/use-case logic get a regression test proving the specific failure mode, not just a code fix.
- Infrastructure code (Drizzle repositories, HTTP adapters) is lower-priority for coverage than domain logic, but a query that does anything non-trivial with SQL (joins, subqueries, aggregates) is worth a real-database test — see `src/infrastructure/repositories/getDue.diagnostic.test.ts`, written specifically because a real due-date query bug once slipped past fake-based tests alone.
- Run `npm test` (and `npx tsc --noEmit`) before considering a change finished, not just when something looks suspicious.

When adding a feature: define the domain entity/port first, write the use case against the interface with a test, then implement the infrastructure adapter last.

## Known gotchas (already debugged once here — don't rediscover)
- **Drizzle's `useLiveQuery` only re-subscribes to changes on a query's primary `FROM` table.** A query that aggregates from a *different* table via a raw SQL subquery (like the deck word-counts pulling from `words` while selecting `FROM decks`) will never auto-refresh when that other table changes. See `useDecksWithCounts.ts` for the manual multi-table-watch workaround using `addDatabaseChangeListener` directly.
- **`expo-sqlite` cannot run on the web platform in this project's dev environment.** Its WASM backend needs `SharedArrayBuffer` / cross-origin isolation that this sandbox's browser preview can't provide (confirmed: Metro's dev server headers don't reach the page in time, and the iframe context blocks cross-origin isolation regardless). Don't debug anything touching the database via `npm run web` — verify on-device (Expo Go or a build) instead.
- **Never request `base64: true` directly from `expo-image-picker` on a full-resolution camera capture.** A 12MP+ photo can produce a 20-40MB base64 string over the JS bridge and crash the app. Always get the file URI and downsize via `expo-image-manipulator` first (see `ScanVocabScreen.tsx`'s `prepareImageBase64`).
- **`userInterfaceStyle` in `app.json` must stay `"automatic"`**, not `"light"` — a hardcoded value silently forces the whole app to one appearance at the native level regardless of what the JS-side theme/dark-mode code does.
