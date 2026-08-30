import { InvalidApiKeyError, RateLimitError, ScanFailedError, ScanUnavailableError } from '../../domain/errors/ScanErrors';

// Maps an HTTP failure into the shared domain error taxonomy. Status-code
// semantics (401/403 = auth, 429 = rate limit, 5xx = unavailable) are
// consistent enough across OpenAI/Anthropic/Gemini that one mapping works
// for all three adapters.
export function mapHttpErrorToScanError(status: number, providerLabel: string, bodyExcerpt: string): Error {
  if (status === 401 || status === 403) {
    return new InvalidApiKeyError(providerLabel);
  }
  if (status === 429) {
    return new RateLimitError(providerLabel);
  }
  if (status >= 500) {
    return new ScanUnavailableError(providerLabel);
  }
  return new ScanFailedError(providerLabel, `(${status}) ${bodyExcerpt.slice(0, 200) || 'unknown error'}`);
}
