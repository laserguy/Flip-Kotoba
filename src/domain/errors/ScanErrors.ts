// A small, provider-agnostic error taxonomy for the scan feature. Every
// provider adapter maps its own HTTP/SDK errors into one of these, so the UI
// can decide what to show without knowing which provider is active.

export class MissingApiKeyError extends Error {
  constructor(providerLabel: string) {
    super(`No API key set for ${providerLabel}. Add one in Settings first.`);
    this.name = 'MissingApiKeyError';
  }
}

export class InvalidApiKeyError extends Error {
  constructor(providerLabel: string) {
    super(`Your ${providerLabel} API key was rejected. Check it in Settings.`);
    this.name = 'InvalidApiKeyError';
  }
}

export class RateLimitError extends Error {
  constructor(providerLabel: string) {
    super(`You've hit your ${providerLabel} usage limit. Check your account's billing/usage page.`);
    this.name = 'RateLimitError';
  }
}

export class ScanUnavailableError extends Error {
  constructor(providerLabel: string) {
    super(`${providerLabel} is temporarily unavailable. Try again in a moment.`);
    this.name = 'ScanUnavailableError';
  }
}

export class ScanFailedError extends Error {
  constructor(providerLabel: string, detail: string) {
    super(`${providerLabel} scan failed: ${detail}`);
    this.name = 'ScanFailedError';
  }
}
