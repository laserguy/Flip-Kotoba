import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import type { LLMProvider } from '../../../domain/entities/LLMProvider';
import { getActiveProvider } from '../secureApiKeyStore';

// Routes each extraction to whichever provider the user has selected in
// Settings. The individual models read their own API key.
export class MultiProviderVisionModel implements VisionModel {
  constructor(private readonly models: Record<LLMProvider, VisionModel>) {}

  async extract(imageBase64: string, spec: VisionExtractionSpec): Promise<unknown> {
    const provider = await getActiveProvider();
    return this.models[provider].extract(imageBase64, spec);
  }
}
