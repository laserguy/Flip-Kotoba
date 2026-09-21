import { DrizzleDeckRepository } from '../infrastructure/repositories/DrizzleDeckRepository';
import { DrizzleWordRepository } from '../infrastructure/repositories/DrizzleWordRepository';
import { DrizzleKanjiRepository } from '../infrastructure/repositories/DrizzleKanjiRepository';
import { DrizzleBackupRepository } from '../infrastructure/repositories/DrizzleBackupRepository';
import { JishoDictionaryLookupService } from '../infrastructure/services/JishoDictionaryLookupService';
import { TatoebaExampleSentenceService } from '../infrastructure/services/TatoebaExampleSentenceService';
import { KanjiApiDictionaryService } from '../infrastructure/services/KanjiApiDictionaryService';
import { OpenAiVisionModel } from '../infrastructure/services/vision/OpenAiVisionModel';
import { AnthropicVisionModel } from '../infrastructure/services/vision/AnthropicVisionModel';
import { GeminiVisionModel } from '../infrastructure/services/vision/GeminiVisionModel';
import { MultiProviderVisionModel } from '../infrastructure/services/vision/MultiProviderVisionModel';
import { VisionVocabPageScanner } from '../infrastructure/services/vision/vocabExtraction';
import { VisionKanjiPageScanner } from '../infrastructure/services/vision/kanjiExtraction';
import { createDeckUseCases } from '../domain/usecases/deckUseCases';
import { createWordUseCases } from '../domain/usecases/wordUseCases';
import { createKanjiUseCases } from '../domain/usecases/kanjiUseCases';
import { createWordLookupUseCases } from '../domain/usecases/wordLookupUseCases';
import { createKanjiLookupUseCases } from '../domain/usecases/kanjiLookupUseCases';
import { createVocabScanUseCases } from '../domain/usecases/vocabScanUseCases';
import { createKanjiScanUseCases } from '../domain/usecases/kanjiScanUseCases';
import { createBackupUseCases } from '../domain/usecases/backupUseCases';

const deckRepository = new DrizzleDeckRepository();
const wordRepository = new DrizzleWordRepository();
const kanjiRepository = new DrizzleKanjiRepository();
const backupRepository = new DrizzleBackupRepository();
const dictionaryLookupService = new JishoDictionaryLookupService();
const exampleSentenceService = new TatoebaExampleSentenceService();
const kanjiDictionaryService = new KanjiApiDictionaryService();

const visionModel = new MultiProviderVisionModel({
  openai: new OpenAiVisionModel(),
  anthropic: new AnthropicVisionModel(),
  gemini: new GeminiVisionModel(),
});
const vocabPageScanner = new VisionVocabPageScanner(visionModel);
const kanjiPageScanner = new VisionKanjiPageScanner(visionModel);

export const { createDeck, getDeck, updateDeck, deleteDeck } = createDeckUseCases(deckRepository);

export const {
  createWord,
  updateWord,
  deleteWord,
  getWordById,
  getDueWords,
  recordSwipe,
  moveToMemorized,
  revertFromMemorized,
} = createWordUseCases(wordRepository, deckRepository);

export const {
  createKanji,
  deleteKanji,
  getKanjiById,
  getDueKanji,
  recordKanjiSwipe,
  moveKanjiToMemorized,
  revertKanjiFromMemorized,
} = createKanjiUseCases(kanjiRepository, deckRepository);

export const { lookupWord } = createWordLookupUseCases(dictionaryLookupService, exampleSentenceService);

export const { fillKanjiGaps } = createKanjiLookupUseCases(kanjiDictionaryService);

export const { scanVocabPage } = createVocabScanUseCases(vocabPageScanner);

export const { scanKanjiPage } = createKanjiScanUseCases(kanjiPageScanner);

export const { createBackup, restoreBackup } = createBackupUseCases(backupRepository);
