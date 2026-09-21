import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './src/infrastructure/db/client';
import migrations from './drizzle/migrations';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { darkNavigationTheme, lightNavigationTheme } from './src/theme/navigationTheme';
import { ThemeProvider, useTheme } from './src/theme/useTheme';
import { hasSeenOnboarding } from './src/infrastructure/services/onboardingStore';
import { migrateKanjiReadingsToHiragana } from './src/infrastructure/services/kanjiReadingsMigration';
import { initCrashReporting, reportError } from './src/infrastructure/services/crashReporting';

initCrashReporting();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ErrorBoundary onError={(error, componentStack) => reportError(error, { componentStack })}>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { success, error } = useMigrations(db, migrations);
  const { colors, scheme, isHydrated } = useTheme();
  const [initialRoute, setInitialRoute] = useState<'DeckList' | 'Onboarding' | null>(null);
  const [kanjiReadingsMigrated, setKanjiReadingsMigrated] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => setInitialRoute(seen ? 'DeckList' : 'Onboarding'));
  }, []);

  // Backfills any kanji saved before readings were normalized to hiragana.
  // Runs once the schema migrations above have created the table.
  useEffect(() => {
    if (!success) return;
    migrateKanjiReadingsToHiragana()
      .catch((migrationError) => reportError(migrationError instanceof Error ? migrationError : new Error(String(migrationError))))
      .finally(() => setKanjiReadingsMigrated(true));
  }, [success]);

  const ready = success && isHydrated && initialRoute !== null && kanjiReadingsMigrated;

  return (
    <>
      {error ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>Database migration failed: {error.message}</Text>
        </View>
      ) : !ready ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <NavigationContainer theme={scheme === 'dark' ? darkNavigationTheme : lightNavigationTheme}>
          <RootNavigator initialRouteName={initialRoute} />
        </NavigationContainer>
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { textAlign: 'center' },
});
