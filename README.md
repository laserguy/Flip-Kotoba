# Flip Kotoba

## 📚 Documentation
| | |
|---|---|
| [⚙️ Architecture](docs/ARCHITECTURE.md) | System design, components and flow |
| [📁 Structure](docs/structure.md) | Project organization and responsibilities |
| [🚀 Installation](docs/installation.md) | Requirements and steps to run the project |
| [🧠 Technical decisions](docs/decisions.md) | Trade-offs and design justifications |
| [📖 Usage guide](docs/usage.md) | How to use the app, main flows and edge cases |
| [🧪 Testing](docs/testing.md) | How to run tests and coverage strategy |

---

## Description

Flip Kotoba is an offline-first Android/iOS app for learning Japanese vocabulary and kanji with spaced-repetition flashcards.

- **Word decks**: each word has an optional kanji form, a furigana reading, an English meaning and an optional example sentence. Words are reviewed in **both directions** (JP → EN and EN → JP), and each direction has its own Leitner schedule.
- **Kanji decks**: each kanji has on/kun readings (always stored in hiragana), meanings and up to two example words.
- **Getting words in fast**: a dictionary lookup (jisho.org + tatoeba.org) fills in the add-word form. You can also photograph a textbook vocabulary or kanji page, and a vision model (OpenAI, Anthropic or Gemini, using your own API key) extracts every entry for you to review before saving.
- **Graduation**: once a card has 10 right answers in a row (in both directions, for words), the app offers to move it into a "Memorized" deck. You can move it back later.
- **Backup/restore** to a JSON file, optionally including review progress.

The real use case: a learner working through a textbook like Genki photographs each chapter's vocab list and has a reviewable deck in a minute. They don't have to type 40 entries by hand.

All data lives in an on-device SQLite database. The only network calls are the dictionary lookups and page scans, and scans go straight from the phone to the provider you chose.

## Quick start

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go (SDK 54)** on a phone. Database features don't work in the web preview (see [installation](docs/installation.md)).

## Technologies used

**App framework**
- Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9
- React Navigation 7 (native-stack)

**Persistence**
- expo-sqlite + Drizzle ORM (schema and migrations generated with drizzle-kit)
- expo-secure-store for API keys and preference flags

**Interaction**
- react-native-reanimated 4 + react-native-gesture-handler for the swipe/flip cards
- expo-speech for on-device Japanese pronunciation
- expo-image-picker + expo-image-manipulator for page scans
- expo-document-picker, expo-file-system, expo-sharing for backup files

**External services**
- Vision models: OpenAI, Anthropic or Google Gemini. The model ID for each is set in its adapter under `src/infrastructure/services/vision/`.
- Dictionaries: jisho.org, tatoeba.org, kanjiapi.dev
- Sentry for crash reporting (only when `EXPO_PUBLIC_SENTRY_DSN` is set)

**Tooling**
- Jest (jest-expo preset), @testing-library/react-native, better-sqlite3 for real-database tests
- EAS Build for APK / app-bundle builds

## Quick installation

1. `npm install`
2. `npx expo start`, then open the app in Expo Go on a device
3. Optional: add a vision-provider API key in the app's **Settings** to enable page scanning

Full steps: [docs/installation.md](docs/installation.md)

## Architecture (summary)

The app follows Clean Architecture. `src/domain` holds the entities, the repository/service interfaces (ports), the use cases and the pure SRS rules, with no React or database imports. `src/infrastructure` implements those ports with Drizzle, `expo-secure-store` and HTTP adapters. `src/composition/container.ts` is the single place where the two are wired together. Screens call only the composition root. The one documented exception is a set of live-updating SQLite query hooks. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Project structure

```
App.tsx                 # providers, DB migrations, onboarding gate
drizzle/                # generated SQL migrations
src/
  domain/               # entities, ports, use cases, SRS rules (pure TS)
  infrastructure/       # Drizzle repos, vision + dictionary adapters, secure store
  composition/          # container.ts — the composition root
  screens/              # one file per navigation route
  components/           # SwipeDeck, FlashcardStack, prompts
  hooks/                # useWordReviewSession
  navigation/ theme/ types/
docs/                   # this documentation
```

More detail: [docs/structure.md](docs/structure.md)
