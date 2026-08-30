import { mapHttpErrorToScanError } from './mapHttpErrorToScanError';
import { InvalidApiKeyError, RateLimitError, ScanFailedError, ScanUnavailableError } from '../../domain/errors/ScanErrors';

describe('mapHttpErrorToScanError', () => {
  it('maps 401 and 403 to InvalidApiKeyError', () => {
    expect(mapHttpErrorToScanError(401, 'OpenAI', '')).toBeInstanceOf(InvalidApiKeyError);
    expect(mapHttpErrorToScanError(403, 'Anthropic', '')).toBeInstanceOf(InvalidApiKeyError);
  });

  it('maps 429 to RateLimitError', () => {
    expect(mapHttpErrorToScanError(429, 'Google Gemini', '')).toBeInstanceOf(RateLimitError);
  });

  it('maps any 5xx to ScanUnavailableError', () => {
    expect(mapHttpErrorToScanError(500, 'OpenAI', '')).toBeInstanceOf(ScanUnavailableError);
    expect(mapHttpErrorToScanError(503, 'OpenAI', '')).toBeInstanceOf(ScanUnavailableError);
  });

  it('falls back to ScanFailedError for anything else, including the status and body excerpt', () => {
    const error = mapHttpErrorToScanError(400, 'OpenAI', 'bad request: malformed image');
    expect(error).toBeInstanceOf(ScanFailedError);
    expect(error.message).toContain('400');
    expect(error.message).toContain('bad request: malformed image');
  });

  it('includes the provider label in every error message', () => {
    expect(mapHttpErrorToScanError(401, 'Anthropic', '').message).toContain('Anthropic');
    expect(mapHttpErrorToScanError(429, 'Google Gemini', '').message).toContain('Google Gemini');
  });
});
