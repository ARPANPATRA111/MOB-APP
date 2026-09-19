import type { CartItem } from '../cart';
import { filterCartItems, parsePriceQuery, withinOneEdit } from '../cartSearch';

const line = (id: string, name: string, price: number, quantity = 1): CartItem => ({
  id,
  name,
  price,
  quantity,
  total: Number((price * quantity).toFixed(2)),
  unit: 'piece',
});

const cart: CartItem[] = [
  line('1', 'Basmati Rice 5kg', 450),
  line('2', 'Amul Butter 500g', 275, 2),
  line('3', 'Parle-G Biscuits', 10, 5),
  line('4', 'Tata Salt 1kg', 28),
  line('5', 'Sunflower Oil 1L', 145.5),
  line('6', 'Bananas (Robusta)', 60, 1.5),
];

describe('withinOneEdit', () => {
  it('accepts identical strings and single edits', () => {
    expect(withinOneEdit('rice', 'rice')).toBe(true);
    expect(withinOneEdit('rice', 'ricee')).toBe(true); // insertion
    expect(withinOneEdit('rice', 'ric')).toBe(true); // deletion
    expect(withinOneEdit('rice', 'rise')).toBe(true); // substitution
    expect(withinOneEdit('rice', 'irce')).toBe(true); // adjacent swap
  });

  it('rejects two or more edits', () => {
    expect(withinOneEdit('rice', 'rise5')).toBe(false);
    expect(withinOneEdit('rice', 'ride')).toBe(true);
    expect(withinOneEdit('rice', 'dice5')).toBe(false);
    expect(withinOneEdit('salt', 'sugar')).toBe(false);
  });
});

describe('parsePriceQuery', () => {
  it('reads plain and currency-prefixed amounts', () => {
    expect(parsePriceQuery('45')).toBe(45);
    expect(parsePriceQuery('45.5')).toBe(45.5);
    expect(parsePriceQuery('₹1,200')).toBe(1200);
    expect(parsePriceQuery('Rs 28')).toBe(28);
  });

  it('returns null for text', () => {
    expect(parsePriceQuery('rice')).toBeNull();
    expect(parsePriceQuery('5kg')).toBeNull();
    expect(parsePriceQuery('')).toBeNull();
  });
});

describe('filterCartItems', () => {
  it('returns everything for an empty query, in cart order', () => {
    expect(filterCartItems(cart, '')).toEqual(cart);
    expect(filterCartItems(cart, '   ')).toEqual(cart);
  });

  it('matches names case-insensitively and by partial words', () => {
    expect(filterCartItems(cart, 'RICE').map((c) => c.id)).toEqual(['1']);
    expect(filterCartItems(cart, 'butt').map((c) => c.id)).toEqual(['2']);
    expect(filterCartItems(cart, 'tata salt').map((c) => c.id)).toEqual(['4']);
  });

  it('forgives one typo per word', () => {
    expect(filterCartItems(cart, 'basmati rcie').map((c) => c.id)).toEqual(['1']);
    expect(filterCartItems(cart, 'bisuits').map((c) => c.id)).toEqual(['3']);
    expect(filterCartItems(cart, 'sunflwer').map((c) => c.id)).toEqual(['5']);
    expect(filterCartItems(cart, 'bnana').map((c) => c.id)).toEqual(['6']);
    expect(filterCartItems(cart, 'bananna').map((c) => c.id)).toEqual(['6']);
  });

  it('does not forgive typos in short tokens or in sizes', () => {
    expect(filterCartItems(cart, 'zz')).toEqual([]);
    expect(filterCartItems(cart, '2kg')).toEqual([]);
    expect(filterCartItems(cart, '400g')).toEqual([]);
  });

  it('matches the unit price, with or without a currency prefix', () => {
    expect(filterCartItems(cart, '450').map((c) => c.id)).toEqual(['1']);
    expect(filterCartItems(cart, '₹275').map((c) => c.id)).toEqual(['2']);
    expect(filterCartItems(cart, '145.5').map((c) => c.id)).toEqual(['5']);
  });

  it('narrows by price prefix while typing and matches line totals', () => {
    expect(filterCartItems(cart, '14').map((c) => c.id)).toEqual(['5']);
    expect(filterCartItems(cart, '550').map((c) => c.id)).toEqual(['2']); // 275 × 2
  });

  it('keeps digit-containing names searchable by name too', () => {
    expect(filterCartItems(cart, '5kg').map((c) => c.id)).toEqual(['1']);
    expect(filterCartItems(cart, '1kg').map((c) => c.id)).toEqual(['4']);
  });

  it('preserves the original order for multiple hits', () => {
    expect(filterCartItems(cart, '1').map((c) => c.id)).toEqual(['3', '4', '5']);
    expect(filterCartItems(cart, '6').map((c) => c.id)).toEqual(['6']);
  });
});
