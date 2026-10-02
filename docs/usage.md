# Usage Guide

This guide assumes the app is already running on a device (see [installation.md](installation.md)).

## First launch

A seven-slide tutorial runs once. The onboarding-seen flag is kept in secure storage. You can replay it any time from **Settings → How to Use**.

## Decks

The **Decks** screen has a **Words / Kanji** toggle. A deck holds either words or kanji, never both.

- **+ New** creates a deck of the type currently shown. Names are trimmed, capped at 20 characters, and must be unique (case-insensitive) within that type. A word deck and a kanji deck can share a name.
- **⋮** on a row offers **Rename** or **Delete**. Deleting asks you to confirm twice and removes every card in the deck.
- **Memorized** / **Memorized Kanji** decks are created automatically the first time a card graduates. You can't add cards to them directly.

## Adding words

From a word deck, use **+ Word** or **📷 Scan**.

### Manual entry with dictionary lookup

1. Type the word (kanji or kana).
2. Tap **🔍 Look up meaning & example sentence**. The app queries jisho.org, preferring an entry marked common, and tatoeba.org for an example sentence.
3. Edit anything, then save.

Rules:
- Furigana and English meaning are required. Kanji is optional.
- A Japanese example sentence **requires** an English translation. Saving without one is rejected.

### Scanning a vocabulary page

1. Set an API key first (see [Scan provider](#scan-provider-and-api-keys)).
2. Tap **📷 Scan**, then **Take Photo** or **Choose from Library**.
3. Every entry found appears as an editable row (kanji / furigana / meaning). Fix rows or remove them with ✕.
4. Tap **Save N Words**. Rows with no furigana or no meaning are skipped.

The scan works best on a flat, well-lit textbook list in the style of Genki's vocab pages. A photo of anything else returns "No words found".

## Adding kanji

Kanji decks are **scan-only**. Tap **📷 Scan** on a kanji deck and photograph a kanji page. For each character the scan extracts:

- on and kun readings, converted to hiragana
- meanings
- up to 2 example words

Any field the scan missed is filled automatically from kanjiapi.dev. Tap **🔍 Look up** on a row to retry that fill.

## Reviewing (flashcards)

Open a deck and switch from **List** to **Flashcards**.

- **Tap** a card to flip it.
- **Swipe right**: you knew it. The card moves up one box: due again in 1 → 3 → 7 → 14 days.
- **Swipe left**: you didn't. The card drops to box 1, is due again the same day, and comes back three cards later in the current session.
- **✎** on a card opens it for editing.

### Two directions for words

A word deck has a **JP → EN / EN → JP** toggle, and each label shows how many words are due in that direction. The two directions are scheduled independently.

- When one direction's queue is empty, the card stack tells you how many words are due the other way and gives you a button to switch.
- **🔊** appears only on the Japanese side during **JP → EN** review. It speaks the furigana using the device's Japanese voice. It never plays automatically, and it isn't offered in EN → JP, where it would give the answer away.
- Once a word reaches a 10-right streak in one direction, you'll see "Mastered … — keep going on the other direction!". That direction **pauses** (stops being due) until the other direction also reaches 10.

### Graduating to Memorized

When a card is ready (both directions at a 10-right streak for words; a 10-right streak for kanji), a prompt offers to move it to the Memorized deck. You can dismiss the prompt and keep the card in its deck.

Open a word in the Memorized deck to **revert** it. It goes back to its original deck with its review progress reset. This isn't possible if that deck has since been deleted.

## Settings

### Appearance
**System / Light / Dark**. The default, System, follows the device setting.

### Scan provider and API keys
1. Choose **OpenAI**, **Anthropic** or **Google Gemini**. The selected provider becomes the active one used for scans.
2. Paste your API key and tap **Save Key**. The key is shown masked afterwards. **Remove Key** deletes it.

Each provider stores its own key. Each card shows a rough per-scan cost estimate and a link to the provider's pricing page. Keys stay in the device keychain/keystore and are only ever sent to the provider you chose.

### Backup & Restore
- **Export backup** writes `flip-kotoba-backup-YYYY-MM-DD.json` and opens the share sheet. You choose **Decks & words only** or **Also include review progress**.
- **Restore from backup** **replaces the entire library** with the file's contents. Export first if you want to keep your current data. Files from older app versions restore fine. Files from a newer version are rejected.

## Common errors

| Message | Cause | Fix |
|---|---|---|
| "No API key set" | No key saved for the active provider | Tap **Go to Settings** in the dialog and add one |
| "API key rejected" | The provider returned 401/403 | Check or replace the key, or make sure the account has API access |
| "Usage limit reached" | The provider returned 429 | Wait, or check billing/quota on the provider account |
| "Scan failed" | 5xx, or the response wasn't valid structured JSON | Retry. Try a clearer photo or a different provider |
| "No dictionary entry found for …" | jisho.org has no match | Check the spelling, or fill the fields by hand |
| "Look up failed" | Network error | Check your connection |
| "An English translation is required…" | JP example sentence without EN | Add the translation or clear the JP sentence |
| "That file isn't a Flip Kotoba backup" / "Backup file is invalid: …" | Malformed or foreign JSON | Use a file exported by the app. Nothing was changed |
| "This backup was made by a newer version…" | `formatVersion` is higher than this app supports | Update the app before restoring |
