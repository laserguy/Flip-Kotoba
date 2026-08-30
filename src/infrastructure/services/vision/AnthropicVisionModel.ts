import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import { MissingApiKeyError, ScanFailedError } from '../../../domain/errors/ScanErrors';
import { LLM_PROVIDER_INFO } from '../../../domain/entities/LLMProvider';
import { getApiKey } from '../secureApiKeyStore';
import { mapHttpErrorToScanError } from '../mapHttpErrorToScanError';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Verified against Anthropic's docs as a current vision-capable model; swap if
// you'd prefer a cheaper (Haiku) or more capable (Opus) model.
const MODEL = 'claude-sonnet-5';
const LABEL = LLM_PROVIDER_INFO.anthropic.label;

export class AnthropicVisionModel implements VisionModel {
  async extract(imageBase64: string, spec: VisionExtractionSpec): Promise<unknown> {
    const apiKey = await getApiKey('anthropic');
    if (!apiKey) throw new MissingApiKeyError(LABEL);

    const response = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: spec.prompt },
            ],
          },
        ],
        tools: [
          {
            name: spec.name,
            description: 'Records the structured data extracted from the photographed page.',
            input_schema: spec.jsonSchema,
            strict: true,
          },
        ],
        tool_choice: { type: 'tool', name: spec.name },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw mapHttpErrorToScanError(response.status, LABEL, body || response.statusText);
    }

    const json = (await response.json()) as any;
    const toolUse = json.content?.find(
      (block: any) => block.type === 'tool_use' && block.name === spec.name,
    );
    if (!toolUse?.input || typeof toolUse.input !== 'object') {
      throw new ScanFailedError(LABEL, 'no structured tool output in the response');
    }
    return toolUse.input;
  }
}
