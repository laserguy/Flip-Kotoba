import * as SecureStore from 'expo-secure-store';
import type { LLMProvider } from '../../domain/entities/LLMProvider';

const KEY_PREFIX = 'llm_api_key_';
const ACTIVE_PROVIDER_STORE_KEY = 'active_llm_provider';
const DEFAULT_PROVIDER: LLMProvider = 'openai';

export async function getApiKey(provider: LLMProvider): Promise<string | null> {
  return SecureStore.getItemAsync(`${KEY_PREFIX}${provider}`);
}

export async function setApiKey(provider: LLMProvider, key: string): Promise<void> {
  await SecureStore.setItemAsync(`${KEY_PREFIX}${provider}`, key);
}

export async function clearApiKey(provider: LLMProvider): Promise<void> {
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${provider}`);
}

export async function getActiveProvider(): Promise<LLMProvider> {
  const value = await SecureStore.getItemAsync(ACTIVE_PROVIDER_STORE_KEY);
  return (value as LLMProvider | null) ?? DEFAULT_PROVIDER;
}

export async function setActiveProvider(provider: LLMProvider): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_PROVIDER_STORE_KEY, provider);
}
