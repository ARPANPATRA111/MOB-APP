import { typography, textVariant } from '../../theme/typography';

describe('typography tokens', () => {
  it('defines readable variants for app UI', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(typography.button.fontWeight).toBe('800');
    expect(textVariant('screenTitle').lineHeight).toBeGreaterThan(textVariant('screenTitle').fontSize);
  });
});
