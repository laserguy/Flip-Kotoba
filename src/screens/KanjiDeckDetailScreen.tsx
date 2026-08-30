import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { getDueKanji } from '../composition/container';
import { useKanjiInDeck, type KanjiSort } from '../infrastructure/queries/useKanjiInDeck';
import type { Kanji } from '../domain/entities/Kanji';
import KanjiFlashcards from '../components/KanjiFlashcards';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

const SORT_LABELS: Record<KanjiSort, string> = {
  alphabetical: 'A–Z',
  created: 'Newest',
  lastReviewed: 'Recently Reviewed',
};

function summariseReadings(kanji: Kanji): string {
  return [...kanji.onReadings, ...kanji.kunReadings].join('、');
}

export default function KanjiDeckDetailScreen({ route, navigation }: Props) {
  const { deckId, deckName, deckKind } = route.params;
  const isMemorized = deckKind === 'memorized';
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'list' | 'flashcards'>('list');
  const [sort, setSort] = useState<KanjiSort>('alphabetical');
  const [dueKanji, setDueKanji] = useState<Kanji[] | null>(null);

  const kanji = useKanjiInDeck(deckId, sort);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isMemorized
        ? undefined
        : () => (
            <Pressable onPress={() => navigation.navigate('ScanKanji', { deckId, deckName })} hitSlop={12}>
              <Text style={styles.headerButton}>📷 Scan Kanji</Text>
            </Pressable>
          ),
    });
  }, [navigation, deckId, deckName, isMemorized, styles]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'flashcards') {
        getDueKanji(deckId).then(setDueKanji);
      }
    }, [mode, deckId]),
  );

  const onEnterFlashcards = () => {
    getDueKanji(deckId).then(setDueKanji);
    setMode('flashcards');
  };

  const cycleSort = () => {
    const order: KanjiSort[] = ['alphabetical', 'created', 'lastReviewed'];
    setSort(order[(order.indexOf(sort) + 1) % order.length]);
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
        dueKanji === null ? null : <KanjiFlashcards initialKanji={dueKanji} />
      ) : kanji && kanji.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No kanji yet.</Text>
          {!isMemorized && (
            <Pressable
              style={styles.addButton}
              onPress={() => navigation.navigate('ScanKanji', { deckId, deckName })}
            >
              <Text style={styles.addButtonText}>Scan a kanji page</Text>
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
            data={kanji ?? []}
            keyExtractor={(entry) => String(entry.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('KanjiDetail', { kanjiId: item.id })}
              >
                <Text style={styles.character}>{item.character}</Text>
                <View style={styles.rowMain}>
                  {summariseReadings(item).length > 0 ? (
                    <Text style={styles.readings}>{summariseReadings(item)}</Text>
                  ) : null}
                  {item.meanings.length > 0 ? (
                    <Text style={styles.meanings}>{item.meanings.join(', ')}</Text>
                  ) : null}
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
    modeToggle: { flexDirection: 'row', margin: 12, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 4 },
    modeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    modeButtonActive: { backgroundColor: colors.surface },
    modeButtonText: { color: colors.textSecondary, fontWeight: '600' },
    modeButtonTextActive: { color: colors.textPrimary },
    sortButton: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 8 },
    sortButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
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
    character: { fontSize: 30, color: colors.textPrimary, width: 48 },
    rowMain: { flex: 1, marginLeft: 8 },
    readings: { fontSize: 14, color: colors.textSecondary },
    meanings: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  });
}
