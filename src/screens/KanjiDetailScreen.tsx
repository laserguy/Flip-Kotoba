import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { deleteKanji, getKanjiById, revertKanjiFromMemorized } from '../composition/container';
import type { Kanji } from '../domain/entities/Kanji';
import HeaderMenu, { type HeaderMenuItem } from '../components/HeaderMenu';
import KanjiDetailBody from '../components/KanjiDetailBody';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'KanjiDetail'>;

export default function KanjiDetailScreen({ route, navigation }: Props) {
  const { kanjiId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [kanji, setKanji] = useState<Kanji | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getKanjiById(kanjiId).then((result) => {
      setKanji(result);
      setLoaded(true);
    });
  }, [kanjiId]);

  useLayoutEffect(() => {
    if (!kanji) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }

    const items: HeaderMenuItem[] = [
      {
        label: 'Delete kanji',
        destructive: true,
        onPress: () =>
          Alert.alert('Delete this kanji?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteKanji(kanjiId)
                  .then(() => navigation.goBack())
                  .catch(() => Alert.alert("Couldn't delete", 'Please try again.'));
              },
            },
          ]),
      },
    ];
    if (kanji.originDeckId != null) {
      items.push({
        label: 'Revert to Original Deck',
        onPress: () => {
          revertKanjiFromMemorized(kanjiId)
            .then(() => navigation.goBack())
            .catch(() => Alert.alert("Couldn't revert", 'Please try again.'));
        },
      });
    }

    navigation.setOptions({
      title: kanji.character,
      headerRight: () => <HeaderMenu items={items} />,
    });
  }, [navigation, kanjiId, kanji]);

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!kanji) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingText}>This kanji is no longer in your decks.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.character}>{kanji.character}</Text>
      <KanjiDetailBody kanji={kanji} />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, alignItems: 'center' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    missingText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    character: { fontSize: 88, fontWeight: '700', color: colors.textPrimary, marginBottom: 24 },
  });
}
