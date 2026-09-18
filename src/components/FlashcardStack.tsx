import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ReviewDirection, Word } from '../domain/entities/Word';
import { moveToMemorized, recordSwipe } from '../composition/container';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';
import SwipeDeck from './SwipeDeck';
import MemorizePrompt from './MemorizePrompt';

const DIRECTION_LABEL: Record<ReviewDirection, string> = {
  jpToEn: 'JP → EN',
  enToJp: 'EN → JP',
};

export default function FlashcardStack({
  initialWords,
  direction,
  onEdit,
}: {
  initialWords: Word[];
  direction: ReviewDirection;
  onEdit: (word: Word) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderJapanese = (word: Word) => (
    <>
      <Text style={styles.cardText}>{word.kanji || word.furigana}</Text>
      {word.kanji ? <Text style={styles.furigana}>{word.furigana}</Text> : null}
      {word.exampleSentenceJp ? <Text style={styles.sentence}>{word.exampleSentenceJp}</Text> : null}
    </>
  );

  const renderEnglish = (word: Word) => (
    <>
      <Text style={styles.cardText}>{word.englishMeaning}</Text>
      {word.exampleSentenceEn ? <Text style={styles.sentence}>{word.exampleSentenceEn}</Text> : null}
    </>
  );

  return (
    <SwipeDeck<Word>
      cards={initialWords}
      emptyText="All caught up! No words due right now."
      remainingText={(count) => `${count} word${count === 1 ? '' : 's'} left today`}
      onEdit={onEdit}
      onSwipe={async (word, swipeDirection) => {
        const { readyToMemorize, justMasteredDirection } = await recordSwipe(word.id, direction, swipeDirection);
        return {
          readyToMemorize,
          note: justMasteredDirection
            ? `Mastered ${DIRECTION_LABEL[justMasteredDirection]} — keep going on the other direction!`
            : null,
        };
      }}
      renderFront={direction === 'jpToEn' ? renderJapanese : renderEnglish}
      renderBack={direction === 'jpToEn' ? renderEnglish : renderJapanese}
      renderMemorizePrompt={(word, dismiss) => (
        <MemorizePrompt
          title="You know this word well in both directions!"
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
