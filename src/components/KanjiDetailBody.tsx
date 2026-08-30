import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Kanji } from '../domain/entities/Kanji';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

// The ordered detail view for a kanji: on'yomi, then kun'yomi, then meanings,
// then example words. Shared by the flashcard flip side and the read-only
// kanji detail screen. Renders nothing for sections with no data.
export default function KanjiDetailBody({ kanji }: { kanji: Kanji }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.body}>
      {kanji.onReadings.length > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>On</Text>
          <Text style={styles.value}>{kanji.onReadings.join('、')}</Text>
        </View>
      )}
      {kanji.kunReadings.length > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Kun</Text>
          <Text style={styles.value}>{kanji.kunReadings.join('、')}</Text>
        </View>
      )}
      {kanji.meanings.length > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Meaning</Text>
          <Text style={styles.value}>{kanji.meanings.join(', ')}</Text>
        </View>
      )}
      {kanji.exampleWords.length > 0 && (
        <View style={styles.examples}>
          {kanji.exampleWords.map((word, index) => (
            <View key={index} style={styles.example}>
              <Text style={styles.exampleJapanese}>{word.japanese}</Text>
              <Text style={styles.exampleEnglish}>{word.english}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { alignSelf: 'stretch', gap: 10 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    label: { width: 64, fontSize: 13, fontWeight: '700', color: colors.textMuted, paddingTop: 2 },
    value: { flex: 1, fontSize: 17, color: colors.textPrimary },
    examples: { marginTop: 6, gap: 8 },
    example: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    exampleJapanese: { fontSize: 16, color: colors.textPrimary },
    exampleEnglish: { fontSize: 14, color: colors.textSecondary, marginTop: 1 },
  });
}
