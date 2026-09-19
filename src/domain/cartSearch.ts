import type { CartItem } from './cart';

/**
 * In-cart search for long bills. A cashier ringing up 200 lines needs to find
 * "the rice" or "the 45 rupee one" without scrolling, so a query matches either
 * the product name (with one typo forgiven per word) or the unit price. The
 * result keeps the cart's own order; nothing is re-sorted.
 */

/** True when `a` and `b` differ by at most one edit (insert, delete, replace or adjacent swap). */
export const withinOneEdit = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length || i === b.length) return true; // pure insertion/deletion at the end
  const restA = a.slice(i + 1);
  const restB = b.slice(i + 1);
  if (a.length === b.length) {
    if (restA === restB) return true; // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  return a.length > b.length ? restA === b.slice(i) : a.slice(i) === restB;
};

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

const words = (text: string) => normalise(text).split(' ').filter(Boolean);

/**
 * One query token matches a name if it appears in it, or is one typo away from
 * a word or word prefix. Tokens with digits ("5kg", "500g") are taken literally:
 * a size or pack count is never a typo of another one.
 */
const tokenMatchesName = (token: string, name: string): boolean => {
  if (name.includes(token)) return true;
  if (token.length < 4 || /\d/.test(token)) return false;
  return words(name).some(
    (word) =>
      withinOneEdit(token, word) ||
      // A typo inside a prefix ("bnana" or "bananna" for "bananas") shifts its length by one either way.
      [token.length - 1, token.length, token.length + 1].some(
        (n) => n >= 3 && word.length > n && withinOneEdit(token, word.slice(0, n)),
      ),
  );
};

/** Reads "45", "45.5", "₹45", "Rs 45", "1,200" as a price; anything else returns null. */
export const parsePriceQuery = (raw: string): number | null => {
  const text = raw
    .trim()
    .replace(/^(?:rs\.?|inr|usd|eur|gbp|[$£€₹])\s*/i, '')
    .replace(/,/g, '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const priceMatches = (item: CartItem, query: string, price: number | null): boolean => {
  if (price === null) return false;
  const unit = Number(item.price.toFixed(2));
  if (unit === price || Number(item.total.toFixed(2)) === price) return true;
  // Typing "4" or "45" while the price is 45.50 should already narrow the list.
  const typed = query.replace(/[^\d.]/g, '');
  return typed.length > 0 && unit.toFixed(2).startsWith(typed);
};

export const filterCartItems = (items: CartItem[], query: string): CartItem[] => {
  const q = normalise(query);
  if (!q) return items;
  const price = parsePriceQuery(q);
  const tokens = words(q);
  return items.filter((item) => {
    const name = normalise(item.name);
    if (tokens.every((token) => tokenMatchesName(token, name))) return true;
    return priceMatches(item, q, price);
  });
};
