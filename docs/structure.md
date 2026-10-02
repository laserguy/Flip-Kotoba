# Project Structure

## Directory tree

```
.
├── App.tsx                         # Root component: providers, migrations, onboarding gate
├── index.ts                        # Expo entry (registerRootComponent)
├── app.json                        # Expo config (plugins, permissions, Android package)
├── eas.json                        # EAS Build profiles: preview (APK), production (AAB)
├── babel.config.js                 # inline-import plugin so .sql files load as strings
├── metro.config.js                 # adds "sql" to Metro's source extensions
├── drizzle.config.ts               # drizzle-kit config (schema → ./drizzle, expo driver)
├── drizzle/
│   ├── 0000_*.sql … 0002_*.sql     # generated migrations
│   ├── meta/                       # drizzle-kit snapshots + journal
│   └── migrations.js               # bundle consumed by useMigrations() in App.tsx
├── assets/                         # icons, splash
├── docs/                           # *.md docs + docs.test.ts (fails when docs drift from code)
├── AGENTS.md / CLAUDE.md           # contributor + AI-agent rules
└── src/
    ├── domain/
    │   ├── entities/               # Deck, Word, Kanji, Backup, LLMProvider
    │   ├── repositories/           # ports: *Repository, *Service, *PageScanner
    │   ├── usecases/               # create*UseCases factories + their tests
    │   ├── errors/ScanErrors.ts    # scan error taxonomy
    │   ├── testing/fakes.ts        # in-memory implementations of every port
    │   ├── constants.ts            # box intervals, streak threshold, name limits
    │   ├── srs.ts                  # Leitner applySwipe / due-date math
    │   ├── reviewDirection.ts      # DueCounts, guidanceForEmptyQueue
    │   └── kana.ts                 # katakana → hiragana
    ├── infrastructure/
    │   ├── db/                     # client.ts (expo-sqlite + drizzle), schema.ts
    │   ├── repositories/           # Drizzle*Repository + *.diagnostic.test.ts
    │   ├── queries/                # live-query React hooks (documented exception)
    │   └── services/
    │       ├── vision/             # OpenAI / Anthropic / Gemini adapters, router, extraction specs
    │       ├── Jisho*, Tatoeba*, KanjiApi*   # dictionary HTTP adapters
    │       ├── ExpoSpeechPronunciationService.ts
    │       ├── secureApiKeyStore.ts, themePreferenceStore.ts, onboardingStore.ts
    │       ├── crashReporting.ts   # Sentry wrapper
    │       └── kanjiReadingsMigration.ts
    ├── composition/container.ts    # composition root
    ├── screens/                    # one component per route
    ├── components/                 # SwipeDeck, FlashcardStack, KanjiFlashcards, MemorizePrompt, …
    ├── hooks/                      # useWordReviewSession (+ test)
    ├── navigation/RootNavigator.tsx
    ├── theme/                      # tokens, ThemeProvider/useTheme, navigation themes
    └── types/navigation.ts         # RootStackParamList
```

## Folder responsibilities

| Folder | Responsibility | Must NOT contain |
|---|---|---|
| `src/domain/` | Business rules: entities, ports, use cases, SRS, validation, error types | Imports of React, React Native, Expo, Drizzle, or `fetch` |
| `src/domain/testing/` | In-memory fakes shared by use-case tests (excluded from Jest's test match) | Real DB access |
| `src/infrastructure/` | Implementations of domain ports; the only layer that touches SQLite, secure storage or HTTP | Business rules (validation, SRS math) — those belong in `domain` |
| `src/infrastructure/queries/` | Reactive read hooks bound to Drizzle live queries | Mutations — writes always go through use cases |
| `src/composition/` | Instantiates adapters and exports ready-to-call use-case functions | Logic of its own |
| `src/screens/`, `src/components/`, `src/hooks/` | UI and UI state | Direct imports from `infrastructure/repositories` or HTTP adapters |
| `drizzle/` | Generated migrations | Hand edits — regenerate with `npm run db:generate` |

## Layer separation

```
screens / components / hooks
        │  import functions from
        ▼
composition/container.ts ──wires──► infrastructure (Drizzle, HTTP, SecureStore)
        │  calls                            │ implements
        ▼                                   ▼
domain/usecases ──depends on──► domain/repositories (interfaces)
```

The presentation layer reaches past the composition root in these places today:

- `src/infrastructure/queries/*` (the documented live-query exception)
- `src/infrastructure/services/secureApiKeyStore.ts` (imported by `SettingsScreen`)
- `src/infrastructure/services/onboardingStore.ts` (imported by `App.tsx` and `OnboardingScreen`)
- `src/infrastructure/services/themePreferenceStore.ts` (used by the theme provider)

The settings and preference stores are thin key/value wrappers with no domain port.
