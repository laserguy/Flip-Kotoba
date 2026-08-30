import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { LLM_PROVIDER_INFO, LLM_PROVIDERS, type LLMProvider } from '../domain/entities/LLMProvider';
import { MEMORIZE_STREAK_THRESHOLD } from '../domain/constants';
import { reviewScheduleSteps } from '../domain/srs';
import { createBackup, restoreBackup } from '../composition/container';
import { getActiveProvider, setActiveProvider, getApiKey, setApiKey, clearApiKey } from '../infrastructure/services/secureApiKeyStore';
import { THEME_PREFERENCE_OPTIONS, useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const REVIEW_SCHEDULE = reviewScheduleSteps();

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
}

function formatReviewInterval(intervalDays: number): string {
  if (intervalDays === 0) return 'Shown again the same day';
  if (intervalDays === 1) return 'Shown again the next day';
  return `Shown again after ${intervalDays} days`;
}

export default function SettingsScreen({ navigation }: Props) {
  const [activeProvider, setActiveProviderState] = useState<LLMProvider | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openai');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    getActiveProvider().then((provider) => {
      setActiveProviderState(provider);
      setSelectedProvider(provider);
    });
  }, []);

  useEffect(() => {
    setLoaded(false);
    setInput('');
    getApiKey(selectedProvider).then((key) => {
      setStoredKey(key);
      setLoaded(true);
    });
  }, [selectedProvider]);

  const onSelectProvider = async (provider: LLMProvider) => {
    setSelectedProvider(provider);
    await setActiveProvider(provider);
    setActiveProviderState(provider);
  };

  const onSave = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    await setApiKey(selectedProvider, trimmed);
    setStoredKey(trimmed);
    setInput('');
  };

  const onClear = () => {
    Alert.alert('Remove this API key?', 'Scanning with this provider will stop working until you add a new key.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearApiKey(selectedProvider);
          setStoredKey(null);
        },
      },
    ]);
  };

  const [backupBusy, setBackupBusy] = useState(false);

  const runExport = async (includeSrsProgress: boolean) => {
    setBackupBusy(true);
    try {
      const snapshot = await createBackup({ includeSrsProgress });
      const fileName = `flip-kotoba-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save Flip Kotoba backup' });
      } else {
        Alert.alert('Backup saved', `Saved to ${uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBackupBusy(false);
    }
  };

  const onExport = () => {
    Alert.alert('Export backup', 'What should the backup include?', [
      { text: 'Decks & words only', onPress: () => runExport(false) },
      { text: 'Also include review progress', onPress: () => runExport(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const runImport = async () => {
    setBackupBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled) return;
      const text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const { deckCount, wordCount, kanjiCount } = await restoreBackup(parsed);
      Alert.alert(
        'Restore complete',
        `Restored ${deckCount} deck${deckCount === 1 ? '' : 's'}, ${wordCount} word${wordCount === 1 ? '' : 's'} and ${kanjiCount} kanji.`,
      );
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBackupBusy(false);
    }
  };

  const onImport = () => {
    Alert.alert(
      'Restore from backup?',
      'This replaces every deck and word currently in the app with the contents of the backup file. Export your current data first if you might still need it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose file', style: 'destructive', onPress: runImport },
      ],
    );
  };

  const info = LLM_PROVIDER_INFO[selectedProvider];

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <Pressable style={styles.helpButton} onPress={() => navigation.navigate('Onboarding', { mode: 'replay' })}>
        <Text style={styles.helpButtonIcon}>❓</Text>
        <View style={styles.helpButtonTextGroup}>
          <Text style={styles.helpButtonTitle}>How to Use</Text>
          <Text style={styles.helpButtonSubtitle}>Replay the quick tutorial</Text>
        </View>
        <Text style={styles.helpButtonChevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <Text style={styles.description}>Pin the app to a light or dark theme, or let it follow your device.</Text>

      <View style={styles.providerTabs}>
        {THEME_PREFERENCE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.providerTab, preference === option.value && styles.providerTabActive]}
            onPress={() => setPreference(option.value)}
          >
            <Text style={[styles.providerTabText, preference === option.value && styles.providerTabTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Scan Provider</Text>
      <Text style={styles.description}>
        Choose which AI service powers "Scan Vocab Page." Each needs its own API key from that provider's account.
      </Text>

      <View style={styles.providerTabs}>
        {LLM_PROVIDERS.map((provider) => (
          <Pressable
            key={provider}
            style={[styles.providerTab, selectedProvider === provider && styles.providerTabActive]}
            onPress={() => onSelectProvider(provider)}
          >
            <Text style={[styles.providerTabText, selectedProvider === provider && styles.providerTabTextActive]}>
              {LLM_PROVIDER_INFO[provider].label}
            </Text>
            {activeProvider === provider && <Text style={styles.activeBadge}>Active</Text>}
          </Pressable>
        ))}
      </View>

      {!loaded ? null : (
        <>
          <Text style={styles.costNote}>
            Estimated cost: {info.costEstimate}. This is a rough estimate, not a guarantee — actual cost depends on
            image size and {info.label}'s current pricing.{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(info.pricingUrl)}>
              View current pricing ↗
            </Text>
          </Text>

          {storedKey ? (
            <View style={styles.currentKeyBox}>
              <Text style={styles.currentKeyLabel}>Current key</Text>
              <Text style={styles.currentKeyValue}>{maskKey(storedKey)}</Text>
            </View>
          ) : (
            <Text style={styles.noKeyText}>No {info.label} API key set yet.</Text>
          )}

          <Text style={styles.label}>{storedKey ? 'Replace key' : 'Enter key'}</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={selectedProvider === 'openai' ? 'sk-...' : selectedProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Pressable style={[styles.saveButton, !input.trim() && styles.saveButtonDisabled]} onPress={onSave} disabled={!input.trim()}>
            <Text style={styles.saveButtonText}>Save Key</Text>
          </Pressable>

          {storedKey && (
            <Pressable style={styles.clearButton} onPress={onClear}>
              <Text style={styles.clearButtonText}>Remove Key</Text>
            </Pressable>
          )}
        </>
      )}

      <Text style={styles.securityNote}>
        Keys are stored encrypted on this device (Keychain / Android Keystore) and sent directly from your phone to
        the selected provider when you scan a page — never stored or transmitted anywhere else.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Backup & Restore</Text>
      <Text style={styles.description}>
        Save all your decks and words to a file you can keep, move to another phone, or restore after reinstalling.
        Choose whether the backup also includes your review progress.
      </Text>

      <Pressable
        style={[styles.backupButton, backupBusy && styles.backupButtonDisabled]}
        onPress={onExport}
        disabled={backupBusy}
      >
        <Text style={styles.backupButtonText}>{backupBusy ? 'Working…' : 'Export backup'}</Text>
      </Pressable>
      <Pressable
        style={[styles.restoreButton, backupBusy && styles.backupButtonDisabled]}
        onPress={onImport}
        disabled={backupBusy}
      >
        <Text style={styles.restoreButtonText}>Restore from backup</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>How review scheduling works</Text>
      <Text style={styles.description}>
        Every word sits in a numbered box. Swipe right on a flashcard and the word moves up a box and comes back
        less often; swipe left and it drops to Box 1 and returns the same day.
      </Text>

      <View style={styles.scheduleCard}>
        {REVIEW_SCHEDULE.map((step, index) => (
          <View
            key={step.boxLevel}
            style={[styles.scheduleRow, index === REVIEW_SCHEDULE.length - 1 && styles.scheduleRowLast]}
          >
            <Text style={styles.scheduleBox}>Box {step.boxLevel}</Text>
            <Text style={styles.scheduleInterval}>{formatReviewInterval(step.intervalDays)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.securityNote}>
        Answer a word correctly {MEMORIZE_STREAK_THRESHOLD} times in a row and it graduates to the Memorized deck
        automatically.
      </Text>
    </KeyboardAwareScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { padding: 16, paddingBottom: 40 },
    helpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      marginBottom: 24,
    },
    helpButtonIcon: { fontSize: 22, marginRight: 12 },
    helpButtonTextGroup: { flex: 1 },
    helpButtonTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    helpButtonSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    helpButtonChevron: { fontSize: 20, color: colors.textMuted },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: colors.textPrimary },
    description: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 16 },
    providerTabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 4, marginBottom: 16 },
    providerTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    providerTabActive: { backgroundColor: colors.surface },
    providerTabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    providerTabTextActive: { color: colors.textPrimary },
    activeBadge: { color: colors.success, fontSize: 10, fontWeight: '700', marginTop: 2 },
    costNote: { fontSize: 12, color: colors.textSecondary, backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, marginBottom: 16, lineHeight: 17 },
    link: { color: colors.accent, fontWeight: '600' },
    currentKeyBox: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 20 },
    currentKeyLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    currentKeyValue: { fontSize: 15, color: colors.textPrimary, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
    noKeyText: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
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
    saveButton: { marginTop: 16, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    saveButtonDisabled: { backgroundColor: colors.accentDisabled },
    saveButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    clearButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
    clearButtonText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
    securityNote: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 24 },
    backupButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    backupButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
    backupButtonDisabled: { opacity: 0.5 },
    restoreButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    restoreButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 28, marginBottom: 24 },
    scheduleCard: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 12 },
    scheduleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    scheduleRowLast: { borderBottomWidth: 0 },
    scheduleBox: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    scheduleInterval: { fontSize: 13, color: colors.textSecondary },
  });
}
