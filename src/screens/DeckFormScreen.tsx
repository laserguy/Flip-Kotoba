import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createDeck, getDeck, updateDeck } from '../composition/container';
import { DECK_NAME_MAX_LENGTH } from '../domain/constants';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckForm'>;

export default function DeckFormScreen({ route, navigation }: Props) {
  const { content, deckId } = route.params;
  const isEditing = deckId !== undefined;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (deckId === undefined) return;
    getDeck(deckId).then((deck) => {
      if (deck) {
        setName(deck.name);
        setDescription(deck.description ?? '');
      }
      setLoading(false);
    });
  }, [deckId]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && trimmedName.length <= DECK_NAME_MAX_LENGTH && !saving && !loading;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (deckId !== undefined) {
        await updateDeck(deckId, { name: trimmedName, description: description.trim() || null });
      } else {
        await createDeck({ name: trimmedName, description: description.trim() || null, content });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ActivityIndicator style={styles.flex} size="large" color={colors.accent} />
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <Text style={styles.label}>
        Name ({name.trim().length}/{DECK_NAME_MAX_LENGTH})
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={DECK_NAME_MAX_LENGTH}
        placeholder="e.g. JLPT N5"
        placeholderTextColor={colors.textMuted}
        autoFocus
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="What this deck is about"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={onSave} disabled={!canSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Deck'}</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { padding: 16 },
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
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    saveButton: {
      marginTop: 24,
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: colors.accentDisabled },
    saveButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  });
}
