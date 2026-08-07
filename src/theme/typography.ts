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

export const typography: Record<TypographyVariant, TypographySpec> = {
  display: { fontSize: readable(30), lineHeight: readable(36), fontWeight: '900' },
  screenTitle: { fontSize: readable(26), lineHeight: readable(32), fontWeight: '900' },
  sectionTitle: { fontSize: readable(18), lineHeight: readable(24), fontWeight: '800' },
  body: { fontSize: readable(15), lineHeight: readable(22), fontWeight: '400' },
  bodyStrong: { fontSize: readable(15), lineHeight: readable(22), fontWeight: '700' },
  caption: { fontSize: readable(12), lineHeight: readable(17), fontWeight: '600' },
  stat: { fontSize: readable(24), lineHeight: readable(30), fontWeight: '900' },
  button: { fontSize: readable(15), lineHeight: readable(20), fontWeight: '800' },
};

export const textVariant = (variant: TypographyVariant) => typography[variant];
