import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createWord, scanVocabPage } from '../composition/container';
import { InvalidApiKeyError, MissingApiKeyError, RateLimitError } from '../domain/errors/ScanErrors';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanVocab'>;

type ReviewRow = {
  id: string;
  kanji: string;
  furigana: string;
  englishMeaning: string;
};

let nextRowId = 0;

// Caps the longest edge so we're never base64-encoding a full-resolution
// camera capture (12MP+ photos can produce 20-40MB base64 strings, which was
// crashing the app). 1600px is plenty for the vision model to read text.
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

export default function ScanVocabScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

  const runScan = async (asset: ImagePicker.ImagePickerAsset) => {
    setScanning(true);
    try {
      const base64 = await prepareImageBase64(asset.uri);
      const words = await scanVocabPage(base64);
      if (words.length === 0) {
        Alert.alert('No words found', "Couldn't find any vocabulary entries in that photo. Try a clearer photo of the page.");
        return;
      }
      setRows(
        words.map((w) => ({
          id: String(nextRowId++),
          kanji: w.kanji ?? '',
          furigana: w.furigana,
          englishMeaning: w.englishMeaning,
        })),
      );
    } catch (error) {
      if (error instanceof MissingApiKeyError || error instanceof InvalidApiKeyError) {
        Alert.alert(error instanceof MissingApiKeyError ? 'No API key set' : 'API key rejected', error.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ]);
      } else if (error instanceof RateLimitError) {
        Alert.alert('Usage limit reached', error.message);
      } else {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        Alert.alert('Scan failed', message);
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
    // No permission request needed: launchImageLibraryAsync uses the system
    // photo picker, so the app never holds a broad photo-library permission.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled) runScan(result.assets[0]);
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? null);
  };

  const saveAll = async () => {
    if (!rows) return;
    const valid = rows.filter((r) => r.furigana.trim() && r.englishMeaning.trim());
    if (valid.length === 0) {
      Alert.alert('Nothing to save', 'Every row needs at least a furigana reading and a meaning.');
      return;
    }
    setSaving(true);
    try {
      for (const row of valid) {
        await createWord({
          deckId,
          kanji: row.kanji.trim() || null,
          furigana: row.furigana.trim(),
          englishMeaning: row.englishMeaning.trim(),
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Save failed', 'Some words may not have been saved. Open the deck to check which ones were added.');
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
          Take or choose a photo of a vocabulary page. Each entry found will be added here for you to review before
          saving.
        </Text>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>For best results</Text>
          <Text style={styles.tipsItem}>✓ A textbook page with rows of words + readings + meanings (like a Genki vocab list)</Text>
          <Text style={styles.tipsItem}>✓ Page flat, well-lit, and filling most of the frame</Text>
          <Text style={styles.tipsItem}>✓ Text in focus, not blurry</Text>
          <Text style={styles.tipsItem}>✕ Not a photo of something other than a vocabulary list — you'll get an empty result</Text>
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
      <Text style={styles.reviewHint}>Review and edit before saving. Remove anything that isn't right.</Text>
      <FlatList
        style={{ backgroundColor: colors.background }}
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowFields}>
              <TextInput
                style={styles.rowInput}
                value={item.kanji}
                onChangeText={(text) => updateRow(item.id, { kanji: text })}
                placeholder="Kanji (optional)"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.rowInput}
                value={item.furigana}
                onChangeText={(text) => updateRow(item.id, { furigana: text })}
                placeholder="Furigana"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.rowInput}
                value={item.englishMeaning}
                onChangeText={(text) => updateRow(item.id, { englishMeaning: text })}
                placeholder="Meaning"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Pressable onPress={() => removeRow(item.id)} hitSlop={12} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>✕</Text>
            </Pressable>
          </View>
        )}
      />
      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={saveAll} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : `Save ${rows.length} Word${rows.length === 1 ? '' : 's'}`}</Text>
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
    tipsCard: {
      width: '100%',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      marginBottom: 20,
    },
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
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    },
    rowFields: { flex: 1, gap: 6 },
    rowInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    removeButton: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
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
