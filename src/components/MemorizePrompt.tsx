import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

// Shown by SwipeDeck once an item's streak hits the memorize threshold. The
// caller supplies the copy and the "move to memorized" action; dismissing just
// returns to the deck.
export default function MemorizePrompt({
  title,
  headline,
  subline,
  onMemorize,
  onDismiss,
}: {
  title: string;
  headline: string;
  subline: string;
  onMemorize: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.subline}>{subline}</Text>
      <Pressable style={styles.memorizeButton} onPress={onMemorize}>
        <Text style={styles.memorizeButtonText}>Move to Memorized</Text>
      </Pressable>
      <Pressable style={styles.notYetButton} onPress={onDismiss}>
        <Text style={styles.notYetButtonText}>Not yet</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { width: '90%', alignItems: 'center', padding: 24 },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.textPrimary },
    headline: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
    subline: { fontSize: 16, color: colors.textSecondary, marginTop: 4, marginBottom: 24, textAlign: 'center' },
    memorizeButton: { backgroundColor: colors.success, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24 },
    memorizeButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    notYetButton: { marginTop: 12, paddingVertical: 8 },
    notYetButtonText: { color: colors.textSecondary, fontSize: 15 },
  });
}
