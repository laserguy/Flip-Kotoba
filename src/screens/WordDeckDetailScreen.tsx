import { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useWordsInDeck, type WordSort } from '../infrastructure/queries/useWordsInDeck';
import type { ReviewDirection, Word } from '../domain/entities/Word';
import FlashcardStack from '../components/FlashcardStack';
import { directionToggleLabel } from '../components/reviewDirectionText';
import { useWordReviewSession } from '../hooks/useWordReviewSession';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

const SORT_LABELS: Record<WordSort, string> = {
  alphabetical: 'A–Z',
  created: 'Newest',
  lastReviewed: 'Recently Reviewed',
};

const REVIEW_DIRECTIONS: ReviewDirection[] = ['jpToEn', 'enToJp'];

export default function WordDeckDetailScreen({ route, navigation }: Props) {
  const { deckId, deckName, deckKind } = route.params;
  const isMemorized = deckKind === 'memorized';
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'list' | 'flashcards'>('list');
  const [sort, setSort] = useState<WordSort>('alphabetical');
  const { direction, dueWords, dueCounts, startSession, switchDirection, refreshDueCounts } = useWordReviewSession(
    deckId,
    mode === 'flashcards',
  );

  const words = useWordsInDeck(deckId, sort);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isMemorized
        ? undefined
        : () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => navigation.navigate('WordForm', { deckId })} hitSlop={12}>
                <Text style={styles.headerButton}>+ Word</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('ScanVocab', { deckId, deckName })} hitSlop={12}>
                <Text style={styles.headerButton}>📷 Scan</Text>
              </Pressable>
            </View>
          ),
    });
  }, [navigation, deckId, deckName, isMemorized, styles]);

  const onEnterFlashcards = () => {
    startSession();
    setMode('flashcards');
  };

  const cycleSort = () => {
    const order: WordSort[] = ['alphabetical', 'created', 'lastReviewed'];
    setSort(order[(order.indexOf(sort) + 1) % order.length]);
  };

  const openWord = (word: Word) => {
    if (isMemorized) {
      navigation.navigate('WordDetail', { wordId: word.id });
    } else {
      navigation.navigate('WordForm', { deckId, wordId: word.id });
    }
  };

  return (
    <View style={styles.container}>
      {!isMemorized && (
        <View style={styles.modeToggle}>
          <Pressable style={[styles.modeButton, mode === 'list' && styles.modeButtonActive]} onPress={() => setMode('list')}>
            <Text style={[styles.modeButtonText, mode === 'list' && styles.modeButtonTextActive]}>List</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'flashcards' && styles.modeButtonActive]}
            onPress={onEnterFlashcards}
          >
            <Text style={[styles.modeButtonText, mode === 'flashcards' && styles.modeButtonTextActive]}>Flashcards</Text>
          </Pressable>
        </View>
      )}

      {mode === 'flashcards' && !isMemorized ? (
        <>
          <View style={styles.directionToggle}>
            {REVIEW_DIRECTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.directionOption, option === direction && styles.directionOptionActive]}
                onPress={() => switchDirection(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: option === direction }}
              >
                <Text style={[styles.directionOptionText, option === direction && styles.directionOptionTextActive]}>
                  {directionToggleLabel(option, dueCounts?.[option])}
                </Text>
              </Pressable>
            ))}
          </View>
          {dueWords === null ? null : (
            <FlashcardStack
              initialWords={dueWords}
              direction={direction}
              dueCounts={dueCounts}
              onEdit={(word) => navigation.navigate('WordForm', { deckId, wordId: word.id })}
              onSwitchDirection={switchDirection}
              onReviewed={refreshDueCounts}
            />
          )}
        </>
      ) : words && words.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No words yet.</Text>
          {!isMemorized && (
            <Pressable style={styles.addButton} onPress={() => navigation.navigate('WordForm', { deckId })}>
              <Text style={styles.addButtonText}>Add your first word</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {!isMemorized && (
            <Pressable style={styles.sortButton} onPress={cycleSort}>
              <Text style={styles.sortButtonText}>Sort: {SORT_LABELS[sort]}</Text>
            </Pressable>
          )}
          <FlatList
            style={{ backgroundColor: colors.background }}
            data={words ?? []}
            keyExtractor={(word) => String(word.id)}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => openWord(item)}>
                <View style={styles.rowMain}>
                  <Text style={styles.wordFurigana}>{item.kanji || item.furigana}</Text>
                  {item.kanji ? <Text style={styles.wordSub}>{item.furigana}</Text> : null}
                  <Text style={styles.wordMeaning}>{item.englishMeaning}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerButton: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    modeToggle: { flexDirection: 'row', margin: 12, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 4 },
    modeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    modeButtonActive: { backgroundColor: colors.surface },
    modeButtonText: { color: colors.textSecondary, fontWeight: '600' },
    modeButtonTextActive: { color: colors.textPrimary },
    sortButton: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 8 },
    sortButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    directionToggle: { flexDirection: 'row', alignSelf: 'center', gap: 8, marginBottom: 8 },
    directionOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    directionOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    directionOptionText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    directionOptionTextActive: { color: colors.textOnAccent },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16 },
    addButton: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
    addButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    rowMain: { flex: 1 },
    wordFurigana: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
    wordSub: { fontSize: 13, color: colors.textMuted },
    wordMeaning: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  });
}
