/** Parameter-only LIKE patterns. Never interpolate a user's input into SQL. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
export function parseCatalogQuery(raw: string) {
  const text = raw.trim().slice(0, 100);
  const numeric = text
    .replace(/^(?:[$\u00a3\u20ac\u20b9]|INR|USD|EUR|GBP)\s*/i, "")
    .replace(/,/g, "");
  const priceCents =
    /^\d+(?:\.\d{1,2})?$/.test(numeric) && Number(numeric) <= 1e9
      ? Math.round(Number(numeric) * 100)
      : null;
  return { text, priceCents };
}

/** One edit or adjacent transposition, bounded to a single 3–24 character word. */
export function fuzzyLikePatterns(raw: string): string[] {
  const word = raw.trim().toLowerCase();
  if (!/^[a-z]{3,24}$/.test(word)) return [];
  const patterns = new Set<string>();
  for (let i = 0; i < word.length; i++) {
    patterns.add(`%${word.slice(0, i)}_${word.slice(i + 1)}%`);
    if (word.length > 3)
      patterns.add(`%${word.slice(0, i)}${word.slice(i + 1)}%`);
    patterns.add(`%${word.slice(0, i)}_${word.slice(i)}%`);
    if (i < word.length - 1)
      patterns.add(
        `%${word.slice(0, i)}${word[i + 1]}${word[i]}${word.slice(i + 2)}%`,
      );
  }
  return [...patterns];
}
