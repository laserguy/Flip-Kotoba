import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { deleteWord, getWordById, revertFromMemorized, speakWord } from '../composition/container';
import type { Word } from '../domain/entities/Word';
import HeaderMenu, { type HeaderMenuItem } from '../components/HeaderMenu';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordDetail'>;

export default function WordDetailScreen({ route, navigation }: Props) {
  const { wordId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [word, setWord] = useState<Word | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getWordById(wordId).then((result) => {
      setWord(result);
      setLoaded(true);
    });
  }, [wordId]);

  useLayoutEffect(() => {
    if (!word) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }

    const items: HeaderMenuItem[] = [
      {
        label: 'Delete word',
        destructive: true,
        onPress: () =>
          Alert.alert('Delete this word?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteWord(wordId)
                  .then(() => navigation.goBack())
                  .catch(() => Alert.alert("Couldn't delete", 'Please try again.'));
              },
            },
          ]),
      },
    ];
    if (word.originDeckId != null) {
      items.push({
        label: 'Revert to Original Deck',
        onPress: () => {
          revertFromMemorized(wordId)
            .then(() => navigation.goBack())
            .catch(() => Alert.alert("Couldn't revert", 'Please try again.'));
        },
      });
    }

    navigation.setOptions({
      title: word.kanji || word.furigana,
      headerRight: () => <HeaderMenu items={items} />,
    });
  }, [navigation, wordId, word]);

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!word) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingText}>This word is no longer in your decks.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headwordRow}>
        <Text style={styles.headword}>{word.kanji || word.furigana}</Text>
        <Pressable
          style={styles.speakButton}
          onPress={() => speakWord(word).catch((error) => console.warn('Speak failed:', error))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Play pronunciation"
        >
          <Text style={styles.speakButtonText}>🔊</Text>
        </Pressable>
      </View>
      {word.kanji ? <Text style={styles.furigana}>{word.furigana}</Text> : null}

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.label}>Meaning</Text>
          <Text style={styles.value}>{word.englishMeaning}</Text>
        </View>
        {word.exampleSentenceJp ? (
          <View style={styles.example}>
            <Text style={styles.exampleJapanese}>{word.exampleSentenceJp}</Text>
            {word.exampleSentenceEn ? <Text style={styles.exampleEnglish}>{word.exampleSentenceEn}</Text> : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    missingText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    headwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headword: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
    speakButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    speakButtonText: { fontSize: 16 },
    furigana: { fontSize: 18, color: colors.textSecondary, marginTop: 4 },
    body: { marginTop: 24, gap: 12 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    label: { width: 72, fontSize: 13, fontWeight: '700', color: colors.textMuted, paddingTop: 2 },
    value: { flex: 1, fontSize: 17, color: colors.textPrimary },
    example: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    exampleJapanese: { fontSize: 16, color: colors.textPrimary },
    exampleEnglish: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  });
}
