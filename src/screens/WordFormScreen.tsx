import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createWord, deleteWord, getWordById, lookupWord, updateWord } from '../composition/container';
import HeaderMenu from '../components/HeaderMenu';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordForm'>;

export default function WordFormScreen({ route, navigation }: Props) {
  const { deckId, wordId } = route.params;
  const isEditing = wordId != null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [kanji, setKanji] = useState('');
  const [furigana, setFurigana] = useState('');
  const [englishMeaning, setEnglishMeaning] = useState('');
  const [exampleSentenceJp, setExampleSentenceJp] = useState('');
  const [exampleSentenceEn, setExampleSentenceEn] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);
  const [lookingUp, setLookingUp] = useState(false);

  useLayoutEffect(() => {
    if (wordId == null) return;
    navigation.setOptions({
      headerRight: () => (
        <HeaderMenu
          items={[
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
          ]}
        />
      ),
    });
  }, [navigation, wordId]);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const existing = await getWordById(wordId);
      if (existing) {
        setKanji(existing.kanji ?? '');
        setFurigana(existing.furigana);
        setEnglishMeaning(existing.englishMeaning);
        setExampleSentenceJp(existing.exampleSentenceJp ?? '');
        setExampleSentenceEn(existing.exampleSentenceEn ?? '');
      }
      setLoaded(true);
    })();
  }, [isEditing, wordId]);

  const onLookUp = async () => {
    const query = kanji.trim() || furigana.trim();
    if (!query || lookingUp) return;
    setLookingUp(true);
    try {
      const { entry, example } = await lookupWord(query);
      if (!kanji.trim() && entry.kanji) setKanji(entry.kanji);
      if (!furigana.trim()) setFurigana(entry.furigana);
      if (!englishMeaning.trim()) setEnglishMeaning(entry.englishMeaning);
      if (example && !exampleSentenceJp.trim()) setExampleSentenceJp(example.japanese);
      if (example && !exampleSentenceEn.trim()) setExampleSentenceEn(example.english);
    } catch (error) {
      Alert.alert('Look up failed', error instanceof Error ? error.message : 'Please check your connection and try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const furiganaOk = furigana.trim().length > 0;
  const meaningOk = englishMeaning.trim().length > 0;
  const sentencePairingOk = exampleSentenceJp.trim().length === 0 || exampleSentenceEn.trim().length > 0;
  const canSave = furiganaOk && meaningOk && sentencePairingOk && !saving && loaded;

  const hasExampleSentences = exampleSentenceJp.trim().length > 0 || exampleSentenceEn.trim().length > 0;
  const clearExampleSentences = () => {
    setExampleSentenceJp('');
    setExampleSentenceEn('');
  };
  const clearExamplesButton = hasExampleSentences ? (
    <Pressable
      onPress={clearExampleSentences}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Clear example sentences"
    >
      <Text style={styles.clearExamples}>✕</Text>
    </Pressable>
  ) : null;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const input = {
        deckId,
        kanji: kanji.trim() || null,
        furigana: furigana.trim(),
        englishMeaning: englishMeaning.trim(),
        exampleSentenceJp: exampleSentenceJp.trim() || null,
        exampleSentenceEn: exampleSentenceEn.trim() || null,
      };
      if (isEditing) {
        await updateWord(wordId, input);
      } else {
        await createWord(input);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <Text style={styles.sectionTitle}>Japanese</Text>

      <Text style={styles.label}>Kanji (optional)</Text>
      <TextInput style={styles.input} value={kanji} onChangeText={setKanji} placeholder="e.g. 食べる" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Furigana *</Text>
      <TextInput style={styles.input} value={furigana} onChangeText={setFurigana} placeholder="e.g. たべる" placeholderTextColor={colors.textMuted} />

      <Pressable
        style={[styles.lookupButton, (lookingUp || (!kanji.trim() && !furigana.trim())) && styles.lookupButtonDisabled]}
        onPress={onLookUp}
        disabled={lookingUp || (!kanji.trim() && !furigana.trim())}
      >
        {lookingUp ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.lookupButtonText}>🔍 Look up meaning &amp; example sentence</Text>
        )}
      </Pressable>

      <View style={styles.exampleLabelRow}>
        <Text style={styles.label}>Example sentence (optional)</Text>
        {clearExamplesButton}
      </View>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={exampleSentenceJp}
        onChangeText={setExampleSentenceJp}
        placeholder="e.g. 朝ごはんを食べる。"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={styles.sectionTitle}>English</Text>

      <Text style={styles.label}>Meaning *</Text>
      <TextInput style={styles.input} value={englishMeaning} onChangeText={setEnglishMeaning} placeholder="e.g. to eat" placeholderTextColor={colors.textMuted} />

      <View style={styles.exampleLabelRow}>
        <Text style={styles.label}>
          Sentence translation {exampleSentenceJp.trim().length > 0 ? '*' : '(optional)'}
        </Text>
        {clearExamplesButton}
      </View>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={exampleSentenceEn}
        onChangeText={setExampleSentenceEn}
        placeholder="e.g. I eat breakfast."
        placeholderTextColor={colors.textMuted}
        multiline
      />
      {!sentencePairingOk && (
        <Text style={styles.errorText}>Translation is required since a Japanese sentence was entered.</Text>
      )}

      <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={onSave} disabled={!canSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Word'}</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 4, color: colors.textPrimary },
    label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    multiline: { minHeight: 70, textAlignVertical: 'top' },
    exampleLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    clearExamples: { color: colors.textMuted, fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
    lookupButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    lookupButtonDisabled: { borderColor: colors.accentDisabled, opacity: 0.6 },
    lookupButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    errorText: { color: colors.danger, fontSize: 13, marginTop: 6 },
    saveButton: {
      marginTop: 28,
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: colors.accentDisabled },
    saveButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  });
}
