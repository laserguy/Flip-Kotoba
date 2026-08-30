import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Word } from '../domain/entities/Word';
import { moveToMemorized, recordSwipe } from '../composition/container';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';
import SwipeDeck from './SwipeDeck';
import MemorizePrompt from './MemorizePrompt';

export default function FlashcardStack({ initialWords }: { initialWords: Word[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SwipeDeck<Word>
      cards={initialWords}
      emptyText="All caught up! No words due right now."
      remainingText={(count) => `${count} word${count === 1 ? '' : 's'} left today`}
      onSwipe={(word, direction) => recordSwipe(word.id, direction)}
      renderFront={(word) => (
        <>
          <Text style={styles.cardText}>{word.kanji || word.furigana}</Text>
          {word.kanji ? <Text style={styles.furigana}>{word.furigana}</Text> : null}
          {word.exampleSentenceJp ? <Text style={styles.sentence}>{word.exampleSentenceJp}</Text> : null}
        </>
      )}
      renderBack={(word) => (
        <>
          <Text style={styles.cardText}>{word.englishMeaning}</Text>
          {word.exampleSentenceEn ? <Text style={styles.sentence}>{word.exampleSentenceEn}</Text> : null}
        </>
      )}
      renderMemorizePrompt={(word, dismiss) => (
        <MemorizePrompt
          title="You know this word well!"
          headline={word.kanji || word.furigana}
          subline={word.englishMeaning}
          onMemorize={() => {
            moveToMemorized(word.id).catch((error) => {
              console.warn('Failed to move word to Memorized:', error);
            });
            dismiss();
          }}
          onDismiss={dismiss}
        />
      )}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardText: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
    furigana: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
    sentence: { fontSize: 16, color: colors.textSecondary, marginTop: 16, textAlign: 'center' },
  });
}
