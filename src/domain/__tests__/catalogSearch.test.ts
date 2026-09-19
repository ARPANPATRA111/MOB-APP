import { escapeLike, fuzzyLikePatterns, parseCatalogQuery } from '../catalogSearch';
test('catalog query accepts exact prices and escapes SQL wildcards', () => {
  expect(parseCatalogQuery('$1,250.50').priceCents).toBe(125050);
  expect(parseCatalogQuery('62').priceCents).toBe(6200);
  expect(parseCatalogQuery('soap').priceCents).toBeNull();
  expect(parseCatalogQuery('1.234').priceCents).toBeNull();
  expect(escapeLike('50%_')).toBe('50\\%\\_');
});
test('fuzzy catalog matching supports typos without unbounded wildcard expansion', () => {
  expect(fuzzyLikePatterns('sopa')).toContain('%soap%');
  expect(fuzzyLikePatterns('rce')).toContain('%r_ce%');
  expect(fuzzyLikePatterns('ricce')).toContain('%rice%');
  expect(fuzzyLikePatterns('rize')).toContain('%ri_e%');
  expect(fuzzyLikePatterns('%')).toEqual([]);
  expect(fuzzyLikePatterns('x'.repeat(25))).toEqual([]);
  expect(fuzzyLikePatterns('62')).toEqual([]);
});
