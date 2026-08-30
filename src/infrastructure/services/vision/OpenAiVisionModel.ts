import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import { MissingApiKeyError, ScanFailedError } from '../../../domain/errors/ScanErrors';
import { LLM_PROVIDER_INFO } from '../../../domain/entities/LLMProvider';
import { getApiKey } from '../secureApiKeyStore';
import { mapHttpErrorToScanError } from '../mapHttpErrorToScanError';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
// Verified against OpenAI's docs as a current vision-capable model; swap if
// your account prefers a different one.
const MODEL = 'gpt-4o';
const LABEL = LLM_PROVIDER_INFO.openai.label;

export class OpenAiVisionModel implements VisionModel {
  async extract(imageBase64: string, spec: VisionExtractionSpec): Promise<unknown> {
    const apiKey = await getApiKey('openai');
    if (!apiKey) throw new MissingApiKeyError(LABEL);

    const response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: spec.prompt },
              { type: 'input_image', image_url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
            ],
          },
        ],
        text: {
          format: { type: 'json_schema', name: spec.name, strict: true, schema: spec.jsonSchema },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw mapHttpErrorToScanError(response.status, LABEL, body || response.statusText);
    }

    const json = (await response.json()) as any;
    const message = json.output?.find((item: any) => item.type === 'message');
    const textPart = message?.content?.find((part: any) => part.type === 'output_text');
    if (typeof textPart?.text !== 'string') {
      throw new ScanFailedError(LABEL, 'no structured output in the response');
    }
    try {
      return JSON.parse(textPart.text);
    } catch {
      throw new ScanFailedError(LABEL, 'the response was not valid JSON');
    }
  }
}
