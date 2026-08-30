import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

// Crash and error reporting. The rest of the app calls initCrashReporting()
// once at startup and reportError() wherever it catches something; nothing
// else imports Sentry, so the provider stays a swappable infrastructure
// detail.
//
// The DSN comes from an EXPO_PUBLIC_ env var (inlined at build time) rather
// than being committed, so the repo stays provider-agnostic and local/dev
// runs report nothing until a DSN is configured.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initCrashReporting(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Never send from Metro/dev — only real builds.
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Crashes and errors only; no performance tracing.
    tracesSampleRate: 0,
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Wraps the root component for Sentry's automatic instrumentation (breadcrumbs
// for taps, navigation, etc.). A passthrough when no DSN is set.
export function withCrashReporting(RootComponent: ComponentType): ComponentType {
  return dsn ? Sentry.wrap(RootComponent) : RootComponent;
}
