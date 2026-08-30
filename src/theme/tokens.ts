// Design tokens shared across the whole app. Screens should never write a
// hex color literal directly — pull it from here via useTheme() so light/dark
// and any future re-theming only need to change one place.

const palette = {
  blue600: '#2563eb',
  blue400: '#5b8def',
  blue300: '#93c5fd',
  blue100: '#dbeafe',
  blueDark: '#1e3a63',
  green600: '#16a34a',
  green400: '#22c55e',
  green100: '#dcfce7',
  greenDark: '#14321f',
  red600: '#dc2626',
  red400: '#f87171',
  red100: '#fee2e2',
  redDark: '#3b1616',
  gray900: '#111827',
  gray700: '#374151',
  gray600: '#4b5563',
  gray500: '#6b7280',
  gray400: '#9ca3af',
  gray300: '#d1d5db',
  gray200: '#e5e7eb',
  gray100: '#f3f4f6',
  gray50: '#f9fafb',
  white: '#ffffff',
  slateDarkBg: '#0b0f17',
  slateDarkSurface: '#151a24',
  slateDarkSurfaceAlt: '#1e2530',
  slateDarkBorder: '#2a3240',
  slateDarkTextSecondary: '#b0b8c4',
  slateDarkTextMuted: '#7d8797',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  accent: string;
  accentMuted: string;
  accentDisabled: string;
  success: string;
  successMuted: string;
  danger: string;
  dangerMuted: string;
}

export const lightColors: ThemeColors = {
  background: palette.white,
  surface: palette.white,
  surfaceAlt: palette.gray100,
  border: palette.gray200,
  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  textMuted: palette.gray500,
  textOnAccent: palette.white,
  accent: palette.blue600,
  accentMuted: palette.blue100,
  accentDisabled: palette.blue300,
  success: palette.green600,
  successMuted: palette.green100,
  danger: palette.red600,
  dangerMuted: palette.red100,
};

export const darkColors: ThemeColors = {
  background: palette.slateDarkBg,
  surface: palette.slateDarkSurface,
  surfaceAlt: palette.slateDarkSurfaceAlt,
  border: palette.slateDarkBorder,
  textPrimary: palette.gray100,
  textSecondary: palette.slateDarkTextSecondary,
  textMuted: palette.slateDarkTextMuted,
  textOnAccent: palette.white,
  accent: palette.blue400,
  accentMuted: palette.blueDark,
  accentDisabled: palette.slateDarkSurfaceAlt,
  success: palette.green400,
  successMuted: palette.greenDark,
  danger: palette.red400,
  dangerMuted: palette.redDark,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 16,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '700' as const },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  smallBold: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
};
