import { normalizeTextSize, textSizeScale, validateShopSetup } from '../onboarding';

test('shop setup validates an explicit currency and preserves international names', () => {
  expect(validateShopSetup('  Corner Shop  ', 'USD')).toEqual({ businessName: 'Corner Shop', currencyCode: 'USD' });
  expect(() => validateShopSetup(' ', 'INR')).toThrow('shop name');
  expect(() => validateShopSetup('Shop', 'XYZ')).toThrow('currency');
  expect(() => validateShopSetup('x'.repeat(101), 'GBP')).toThrow('100');
});

test('text preference is bounded and invalid restored values fall back safely', () => {
  expect(normalizeTextSize('huge')).toBe('medium');
  expect(normalizeTextSize(null)).toBe('medium');
  expect(textSizeScale('small')).toBeLessThan(textSizeScale('medium'));
  expect(textSizeScale('large')).toBeGreaterThan(textSizeScale('medium'));
});
