import { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { DeckContent } from '../domain/entities/Deck';
import { useDecksWithCounts } from '../infrastructure/queries/useDecksWithCounts';
import { deleteDeck } from '../composition/container';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckList'>;

const ITEM_NOUN: Record<DeckContent, { singular: string; plural: string }> = {
  words: { singular: 'word', plural: 'words' },
  kanji: { singular: 'kanji', plural: 'kanji' },
};

export default function DeckListScreen({ navigation }: Props) {
  const allDecks = useDecksWithCounts();
  const [contentFilter, setContentFilter] = useState<DeckContent>('words');
  const { colors, typography } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('DeckForm', { content: contentFilter })} hitSlop={12}>
            <Text style={styles.headerButton}>+ New</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
            <Text style={styles.headerButton}>⚙️</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, styles, contentFilter]);

  const decks = allDecks?.filter((deck) => deck.content === contentFilter);
  const noun = ITEM_NOUN[contentFilter];

  const confirmDelete = (id: number, name: string) => {
    Alert.alert(`Delete "${name}"?`, `This deck and all its ${noun.plural} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Are you sure?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteDeck(id).catch(() => Alert.alert("Couldn't delete", 'Please try again.'));
              },
            },
          ]);
        },
      },
    ]);
  };

  const onMorePress = (id: number, name: string) => {
    Alert.alert(name, undefined, [
      { text: 'Delete Deck', style: 'destructive', onPress: () => confirmDelete(id, name) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const contentToggle = (
    <View style={styles.contentToggle}>
      {(['words', 'kanji'] as const).map((value) => (
        <Pressable
          key={value}
          style={[styles.toggleButton, contentFilter === value && styles.toggleButtonActive]}
          onPress={() => setContentFilter(value)}
        >
          <Text style={[styles.toggleButtonText, contentFilter === value && styles.toggleButtonTextActive]}>
            {value === 'words' ? 'Words' : 'Kanji'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      {contentToggle}
      {!decks || decks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No {contentFilter === 'words' ? 'word' : 'kanji'} decks yet.</Text>
          <Pressable
            style={styles.createButton}
            onPress={() => navigation.navigate('DeckForm', { content: contentFilter })}
          >
            <Text style={styles.createButtonText}>Create your first deck</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          data={decks}
          keyExtractor={(deck) => String(deck.id)}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('DeckDetail', {
                  deckId: item.id,
                  deckName: item.name,
                  deckKind: item.kind,
                  deckContent: item.content,
                })
              }
            >
              <View style={styles.rowMain}>
                <Text style={[typography.subheading, styles.deckName]}>{item.name}</Text>
                {item.kind === 'memorized' ? (
                  <Text style={styles.countMemorized}>
                    ✓ {item.itemCount} {noun.plural}
                  </Text>
                ) : (
                  <View style={styles.countRow}>
                    <Text style={styles.countGreen}>✓ {item.memorizedCount}</Text>
                    <Text style={styles.countSeparator}>·</Text>
                    <Text style={styles.countRed}>○ {item.itemCount - item.memorizedCount}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => onMorePress(item.id, item.name)} hitSlop={12} style={styles.moreButton}>
                <Text style={styles.moreButtonText}>⋮</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerButton: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    contentToggle: {
      flexDirection: 'row',
      margin: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 4,
    },
    toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    toggleButtonActive: { backgroundColor: colors.surface },
    toggleButtonText: { color: colors.textSecondary, fontWeight: '600' },
    toggleButtonTextActive: { color: colors.textPrimary },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16 },
    createButton: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
    createButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    deckName: { color: colors.textPrimary },
    countRow: { flexDirection: 'row', alignItems: 'center' },
    countGreen: { color: colors.success, fontWeight: '700', fontSize: 15 },
    countRed: { color: colors.danger, fontWeight: '700', fontSize: 15 },
    countSeparator: { color: colors.textMuted, marginHorizontal: 4 },
    countMemorized: { color: colors.success, fontWeight: '600', fontSize: 14 },
    moreButton: { paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
    moreButtonText: { fontSize: 22, color: colors.textSecondary },
  });
}
