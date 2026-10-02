# Installation

## Prerequisites

- **Node.js + npm**. Any version supported by Expo SDK 54 works.
- **Expo Go for SDK 54** on an Android or iOS device. Store builds of Expo Go are pinned to SDK 54 for this project, so don't upgrade `expo` past what Expo Go supports or on-device testing breaks.
- **Optional**: an API key from OpenAI, Anthropic or Google AI Studio (Gemini). You only need one, and only for page scanning.
- **Optional**: an [EAS](https://expo.dev/eas) account and `eas-cli` (≥ 12) to build installable APKs or app bundles.

## Steps

### 1. Clone the repo

```bash
git clone https://github.com/laserguy/Flip-Kotoba.git
cd Flip-Kotoba
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

None are required. The only one the code reads is:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | Turns on Sentry crash reporting. Without it, `initCrashReporting()` and `reportError()` do nothing. Reports are only sent from non-dev builds. |

If you need it, put it in `.env.local`, which is gitignored:

```bash
EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

Vision-provider API keys are **not** environment variables. Each user enters their key in the app's **Settings**, and it's stored in the device keychain/keystore through `expo-secure-store`.

### 4. Database

There's nothing to set up. On first launch, `App.tsx` opens `flashcards.db` and applies every migration in `drizzle/` with Drizzle's `useMigrations`. A one-time backfill (`kanjiReadingsMigration.ts`) then converts any legacy katakana kanji readings to hiragana.

After changing `src/infrastructure/db/schema.ts`, regenerate the migrations:

```bash
npm run db:generate
```

### 5. Run

```bash
npx expo start
```

Scan the QR code with Expo Go. `npm run android` / `npm run ios` do the same thing and open the corresponding target directly.

> **Don't use `npm run web` for anything that touches data.** expo-sqlite's web backend needs `SharedArrayBuffer`/cross-origin isolation, which the dev server here doesn't provide. The app fails at the migration step in the browser.

### Building an installable app (optional)

```bash
eas build --profile preview --platform android      # internal APK
eas build --profile production --platform android   # Play Store app bundle
```

Both profiles auto-increment the build number. They also set `SENTRY_DISABLE_AUTO_UPLOAD=true`, so no Sentry auth token is needed at build time.

## Verify it works

1. The app opens to the onboarding slides on first launch, and to the **Decks** list on later launches.
2. Create a deck, add a word, then open the deck and swipe the card. It should flip on tap and slide off on swipe.
3. Run the test suite and type check:

```bash
npm test
npx tsc --noEmit
```
