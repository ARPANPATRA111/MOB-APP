import { developerInfo, isAllowedDeveloperUrl } from '../developerInfo';

describe('developer info helpers', () => {
  it('allows only configured developer links', () => {
    expect(developerInfo.email).toBe('thispc119@gmail.com');
    expect(isAllowedDeveloperUrl('mailto:thispc119@gmail.com')).toBe(true);
    expect(isAllowedDeveloperUrl('https://arpan111.vercel.app/')).toBe(true);
    expect(isAllowedDeveloperUrl('https://example.com')).toBe(false);
  });
});
