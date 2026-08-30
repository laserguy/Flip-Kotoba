import type { VisionExtractionSpec, VisionModel } from './VisionModel';
import { MissingApiKeyError, ScanFailedError } from '../../../domain/errors/ScanErrors';
import { LLM_PROVIDER_INFO } from '../../../domain/entities/LLMProvider';
import { getApiKey } from '../secureApiKeyStore';
import { mapHttpErrorToScanError } from '../mapHttpErrorToScanError';

// Verified against Google's REST API reference as a current vision-capable
// model; swap if a newer/cheaper model is available on your account.
const MODEL = 'gemini-2.5-flash';
const LABEL = LLM_PROVIDER_INFO.gemini.label;

// Gemini's responseSchema follows the OpenAPI 3.0 subset: a nullable field is
// `{ type: 'string', nullable: true }`, not `{ type: ['string', 'null'] }`, and
// `additionalProperties` is rejected. Convert the neutral spec schema recursively.
export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== 'object') return node;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && Array.isArray(value)) {
      const concreteTypes = value.filter((type) => type !== 'null');
      result.type = concreteTypes[0];
      if (value.includes('null')) result.nullable = true;
      continue;
    }
    result[key] = toGeminiSchema(value);
  }
  return result;
}

export class GeminiVisionModel implements VisionModel {
  async extract(imageBase64: string, spec: VisionExtractionSpec): Promise<unknown> {
    const apiKey = await getApiKey('gemini');
    if (!apiKey) throw new MissingApiKeyError(LABEL);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: spec.prompt },
              { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(spec.jsonSchema),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw mapHttpErrorToScanError(response.status, LABEL, body || response.statusText);
    }

    const json = (await response.json()) as any;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new ScanFailedError(LABEL, 'no text output in the response');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ScanFailedError(LABEL, 'the response was not valid JSON');
    }
  }
}
