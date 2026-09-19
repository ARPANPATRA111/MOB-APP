import { typography, textVariant } from '../../theme/typography';

describe('typography tokens', () => {
  it('defines readable variants for app UI', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(Number(typography.button.fontWeight)).toBeGreaterThanOrEqual(600);
    expect(textVariant('screenTitle').lineHeight).toBeGreaterThan(
      textVariant('screenTitle').fontSize
    );
  });
});
