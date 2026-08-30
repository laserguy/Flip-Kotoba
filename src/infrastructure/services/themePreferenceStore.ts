import * as SecureStore from 'expo-secure-store';

// 'system' follows the OS light/dark setting; 'light'/'dark' pin the app to one
// appearance regardless of the device.
export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'theme_preference';

export async function getThemePreference(): Promise<ThemePreference> {
  const stored = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
}
