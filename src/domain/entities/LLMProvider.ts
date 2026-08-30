export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export const LLM_PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'gemini'];

export interface LLMProviderInfo {
  label: string;
  // A rough, non-binding per-scan cost estimate to show alongside the key
  // entry field. Real cost depends on image size, word count, and the
  // provider's current pricing — this is a ballpark, not a quote.
  costEstimate: string;
  pricingUrl: string;
}

export const LLM_PROVIDER_INFO: Record<LLMProvider, LLMProviderInfo> = {
  openai: {
    label: 'OpenAI',
    costEstimate: '~$0.01 or less per scan (gpt-4o)',
    pricingUrl: 'https://openai.com/api/pricing',
  },
  anthropic: {
    label: 'Anthropic',
    costEstimate: '~$0.01–$0.03 per scan (Claude Sonnet)',
    pricingUrl: 'https://claude.com/pricing',
  },
  gemini: {
    label: 'Google Gemini',
    costEstimate: '~$0.01 or less per scan (Gemini Flash)',
    pricingUrl: 'https://ai.google.dev/pricing',
  },
};
