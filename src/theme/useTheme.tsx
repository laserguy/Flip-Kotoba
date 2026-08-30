import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, radius, spacing, typography, type ThemeColors } from './tokens';
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../infrastructure/services/themePreferenceStore';

export type { ThemePreference };

export const THEME_PREFERENCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

type ResolvedScheme = 'light' | 'dark';

interface ThemeContextValue {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  scheme: ResolvedScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  // False until the stored preference has loaded. Gate first render on this to
  // avoid a flash of the wrong theme when the user has pinned light/dark.
  isHydrated: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(preference: ThemePreference, systemScheme: ResolvedScheme): ResolvedScheme {
  return preference === 'system' ? systemScheme : preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme: ResolvedScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    getThemePreference().then((stored) => {
      setPreferenceState(stored);
      setIsHydrated(true);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setThemePreference(next).catch(() => {
      // The in-memory switch above already applied; a failed write only means
      // the choice won't survive a restart, so there's nothing to recover.
    });
  }, []);

  const scheme = resolveScheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      scheme,
      preference,
      setPreference,
      isHydrated,
    }),
    [scheme, preference, setPreference, isHydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export type Theme = ThemeContextValue;
