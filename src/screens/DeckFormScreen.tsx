import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createDeck } from '../composition/container';
import { DECK_NAME_MAX_LENGTH } from '../domain/constants';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckForm'>;

export default function DeckFormScreen({ route, navigation }: Props) {
  const { content } = route.params;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && trimmedName.length <= DECK_NAME_MAX_LENGTH && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createDeck({ name: trimmedName, description: description.trim() || null, content });
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
        <Text style={styles.saveButtonText}>Create Deck</Text>
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
