import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createKanji, fillKanjiGaps, scanKanjiPage } from '../composition/container';
import type { ScannedKanji } from '../domain/repositories/KanjiPageScanner';
import { InvalidApiKeyError, MissingApiKeyError, RateLimitError } from '../domain/errors/ScanErrors';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanKanji'>;

type ReviewRow = { id: string; kanji: ScannedKanji };

let nextRowId = 0;

// A 12MP+ camera capture can produce a 20-40MB base64 string and crash the
// bridge — resize before encoding. 1600px is plenty for the model to read.
const MAX_IMAGE_DIMENSION = 1600;

async function prepareImageBase64(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!result.base64) throw new Error('Could not process that photo.');
  return result.base64;
}

export default function ScanKanjiScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookingUpId, setLookingUpId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

  const runScan = async (asset: ImagePicker.ImagePickerAsset) => {
    setScanning(true);
    try {
      const base64 = await prepareImageBase64(asset.uri);
      const scanned = await scanKanjiPage(base64);
      if (scanned.length === 0) {
        Alert.alert('No kanji found', "Couldn't find any standalone kanji in that photo. Try a clearer photo of a kanji page.");
        return;
      }
      // Auto-fill anything the scan left blank from the dictionary.
      const enriched = await Promise.all(scanned.map((kanji) => fillKanjiGaps(kanji).catch(() => kanji)));
      setRows(enriched.map((kanji) => ({ id: String(nextRowId++), kanji })));
    } catch (error) {
      if (error instanceof MissingApiKeyError || error instanceof InvalidApiKeyError) {
        Alert.alert(error instanceof MissingApiKeyError ? 'No API key set' : 'API key rejected', error.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ]);
      } else if (error instanceof RateLimitError) {
        Alert.alert('Usage limit reached', error.message);
      } else {
        Alert.alert('Scan failed', error instanceof Error ? error.message : 'Something went wrong.');
      }
    } finally {
      setScanning(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Enable camera access for Flip Kotoba in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
    if (!result.canceled) runScan(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled) runScan(result.assets[0]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev?.filter((row) => row.id !== id) ?? null);
  };

  const lookUpRow = async (id: string) => {
    const row = rows?.find((r) => r.id === id);
    if (!row) return;
    setLookingUpId(id);
    try {
      const filled = await fillKanjiGaps(row.kanji);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, kanji: filled } : r)) ?? null);
    } catch {
      Alert.alert('Look up failed', 'Please check your connection and try again.');
    } finally {
      setLookingUpId(null);
    }
  };

  const saveAll = async () => {
    if (!rows || rows.length === 0) return;
    setSaving(true);
    try {
      for (const row of rows) {
        await createKanji({ deckId, ...row.kanji });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Save failed', 'Some kanji may not have been saved. Open the deck to check which ones were added.');
    } finally {
      setSaving(false);
    }
  };

  if (scanning) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.centeredText}>Reading the page…</Text>
      </View>
    );
  }

  if (!rows) {
    return (
      <View style={styles.centered}>
        <Text style={styles.intro}>
          Take or choose a photo of a page that shows individual kanji being studied. Each standalone kanji found is
          added here for you to review before saving.
        </Text>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>For best results</Text>
          <Text style={styles.tipsItem}>✓ A kanji list, kanji flashcards, or a kanji dictionary page</Text>
          <Text style={styles.tipsItem}>✓ Kanji shown on their own, not only inside example words</Text>
          <Text style={styles.tipsItem}>✓ Page flat, well-lit, and filling most of the frame</Text>
          <Text style={styles.tipsItem}>✕ A page with no standalone kanji — you'll get an empty result</Text>
        </View>

        <Pressable style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionButtonText}>📷 Take Photo</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={pickFromLibrary}>
          <Text style={styles.actionButtonText}>🖼️ Choose from Library</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.reviewHint}>Review before saving. Remove anything that isn't right; tap Look up to fill gaps.</Text>
      <FlatList
        style={{ backgroundColor: colors.background }}
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const { kanji } = item;
          const readings = [...kanji.onReadings, ...kanji.kunReadings].join('、');
          return (
            <View style={styles.row}>
              <Text style={styles.character}>{kanji.character}</Text>
              <View style={styles.rowMain}>
                {readings ? <Text style={styles.readings}>{readings}</Text> : null}
                {kanji.meanings.length > 0 ? (
                  <Text style={styles.meanings}>{kanji.meanings.join(', ')}</Text>
                ) : null}
                {kanji.exampleWords.map((word, index) => (
                  <Text key={index} style={styles.example}>
                    {word.japanese} — {word.english}
                  </Text>
                ))}
                <Pressable
                  style={styles.lookupButton}
                  onPress={() => lookUpRow(item.id)}
                  disabled={lookingUpId === item.id}
                >
                  {lookingUpId === item.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.lookupButtonText}>🔍 Look up</Text>
                  )}
                </Pressable>
              </View>
              <Pressable onPress={() => removeRow(item.id)} hitSlop={12} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />
      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={saveAll} disabled={saving}>
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving…' : `Save ${rows.length} Kanji`}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    centeredText: { marginTop: 16, color: colors.textSecondary, fontSize: 15 },
    intro: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 21 },
    tipsCard: { width: '100%', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 20 },
    tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
    tipsItem: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    actionButton: {
      width: '100%',
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    secondaryButton: { backgroundColor: colors.textMuted },
    actionButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    reviewHint: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    list: { padding: 16, paddingTop: 8 },
    row: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    character: { fontSize: 34, color: colors.textPrimary, width: 48 },
    rowMain: { flex: 1, marginLeft: 8, gap: 3 },
    readings: { fontSize: 15, color: colors.textPrimary },
    meanings: { fontSize: 14, color: colors.textSecondary },
    example: { fontSize: 13, color: colors.textMuted },
    lookupButton: {
      alignSelf: 'flex-start',
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    lookupButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    removeButton: { paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
    removeButtonText: { color: colors.danger, fontSize: 18, fontWeight: '700' },
    saveButton: {
      margin: 16,
      backgroundColor: colors.success,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  });
}
