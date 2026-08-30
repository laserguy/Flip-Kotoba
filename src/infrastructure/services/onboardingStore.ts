import * as SecureStore from 'expo-secure-store';

const HAS_SEEN_ONBOARDING_KEY = 'has_seen_onboarding';

export async function hasSeenOnboarding(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(HAS_SEEN_ONBOARDING_KEY);
  return value === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(HAS_SEEN_ONBOARDING_KEY, 'true');
}
