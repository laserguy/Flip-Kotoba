import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ReviewDirection, Word } from '../domain/entities/Word';
import { moveToMemorized, recordSwipe, speakWord } from '../composition/container';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';
import { guidanceForEmptyQueue, type DueCounts } from '../domain/reviewDirection';
import SwipeDeck from './SwipeDeck';
import MemorizePrompt from './MemorizePrompt';
import { DIRECTION_LABELS, emptyQueueText, switchDirectionLabel } from './reviewDirectionText';

export default function FlashcardStack({
  initialWords,
  direction,
  dueCounts,
  onEdit,
  onSwitchDirection,
  onReviewed,
}: {
  initialWords: Word[];
  direction: ReviewDirection;
  dueCounts: DueCounts | null;
  onEdit: (word: Word) => void;
  onSwitchDirection: (direction: ReviewDirection) => void;
  // Called after each swipe has been saved, so due counts can be refreshed.
  onReviewed: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const emptyGuidance = dueCounts ? guidanceForEmptyQueue(direction, dueCounts) : null;
  const emptyAction =
    emptyGuidance?.kind === 'switchDirection'
      ? {
          label: switchDirectionLabel(emptyGuidance.direction),
          onPress: () => onSwitchDirection(emptyGuidance.direction),
        }
      : undefined;

  const speak = (word: Word) => speakWord(word).catch((error) => console.warn('Speak failed:', error));

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
      emptyText={emptyGuidance ? emptyQueueText(direction, emptyGuidance) : 'All caught up! No words due right now.'}
      emptyAction={emptyAction}
      remainingText={(count) => `${count} word${count === 1 ? '' : 's'} left today`}
      onEdit={onEdit}
      onSpeak={direction === 'jpToEn' ? speak : undefined}
      speakSide={direction === 'jpToEn' ? 'front' : undefined}
      onSwipe={async (word, swipeDirection) => {
        const { readyToMemorize, justMasteredDirection } = await recordSwipe(word.id, direction, swipeDirection);
        onReviewed();
        return {
          readyToMemorize,
          note: justMasteredDirection
            ? `Mastered ${DIRECTION_LABELS[justMasteredDirection]} — keep going on the other direction!`
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
