import { PixelRatio } from 'react-native';

export type TypographyVariant =
  | 'display'
  | 'screenTitle'
  | 'sectionTitle'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'stat'
  | 'button';

type TypographySpec = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800' | '900';
};

const readable = (size: number) => {
  const fontScale = PixelRatio.getFontScale();
  if (fontScale > 1.15) {
    return Math.round(size * 1.04);
  }
  return size;
};

/**
 * Compact iOS-like scale. Sizes sit one step under Apple's defaults so dense
 * retail lists fit a phone; the in-app Small/Medium/Large setting scales them.
 */
export const typography: Record<TypographyVariant, TypographySpec> = {
  display: { fontSize: readable(28), lineHeight: readable(34), fontWeight: '700' },
  screenTitle: { fontSize: readable(24), lineHeight: readable(30), fontWeight: '700' },
  sectionTitle: { fontSize: readable(16), lineHeight: readable(21), fontWeight: '600' },
  body: { fontSize: readable(14), lineHeight: readable(20), fontWeight: '400' },
  bodyStrong: { fontSize: readable(14), lineHeight: readable(20), fontWeight: '600' },
  caption: { fontSize: readable(12), lineHeight: readable(16), fontWeight: '500' },
  stat: { fontSize: readable(22), lineHeight: readable(28), fontWeight: '700' },
  button: { fontSize: readable(15), lineHeight: readable(20), fontWeight: '600' },
};

export const textVariant = (variant: TypographyVariant) => typography[variant];
