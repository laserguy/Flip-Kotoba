import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Kanji } from '../domain/entities/Kanji';
import { moveKanjiToMemorized, recordKanjiSwipe } from '../composition/container';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';
import SwipeDeck from './SwipeDeck';
import KanjiDetailBody from './KanjiDetailBody';
import MemorizePrompt from './MemorizePrompt';

export default function KanjiFlashcards({ initialKanji }: { initialKanji: Kanji[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SwipeDeck<Kanji>
      cards={initialKanji}
      emptyText="All caught up! No kanji due right now."
      remainingText={(count) => `${count} kanji left today`}
      onSwipe={(kanji, direction) => recordKanjiSwipe(kanji.id, direction)}
      renderFront={(kanji) => <Text style={styles.character}>{kanji.character}</Text>}
      renderBack={(kanji) => <KanjiDetailBody kanji={kanji} />}
      renderMemorizePrompt={(kanji, dismiss) => (
        <MemorizePrompt
          title="You know this kanji well!"
          headline={kanji.character}
          subline={kanji.meanings.join(', ')}
          onMemorize={() => {
            moveKanjiToMemorized(kanji.id).catch((error) => {
              console.warn('Failed to move kanji to Memorized:', error);
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
    character: { fontSize: 96, fontWeight: '700', color: colors.textPrimary },
  });
}
