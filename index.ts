import { registerRootComponent } from 'expo';

import App from './App';
import { withCrashReporting } from './src/infrastructure/services/crashReporting';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately. withCrashReporting wraps the root for
// Sentry's automatic breadcrumbs (a no-op when no DSN is configured).
registerRootComponent(withCrashReporting(App));
