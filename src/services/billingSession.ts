import { useSyncExternalStore } from 'react';

import { createLocalId } from '../db/schema';

import { deleteDraft, saveDraft, type CheckoutDraft } from '../repositories/draftRepository';

import type { CartItem } from '../domain/cart';

const fresh = (): CheckoutDraft => ({
  id: createLocalId('bill'),
  cart: [],
  customerName: '',
  customerPhone: '',
  discount: '0',
  taxPercent: '0',
  allowCredit: false,
  cash: '',
  upi: '',
  card: '',
  label: '',
});

let current = fresh();
let queue = Promise.resolve();
let error: Error | null = null;

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

const persist = () => {
  const snapshot = structuredCloneSafe(current);
  queue = queue
    .then(async () => {
      if (snapshot.cart.length) await saveDraft(snapshot);
      else await deleteDraft(snapshot.id);
      error = null;
    })
    .catch((e) => {
      error = e;
      current = { ...current };
      emit();
    });
};

const structuredCloneSafe = (draft: CheckoutDraft): CheckoutDraft =>
  JSON.parse(JSON.stringify(draft));

export const billingSession = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getSnapshot: () => current,

  getCart: () => current.cart.map((item) => ({ ...item })),

  setCart: (cart: CartItem[]) => {
    current = { ...current, cart };
    error = null;
    emit();
    persist();
  },

  /**
   * Applies a pure cart transform to the live lines. Unlike `getCart()` this
   * does not copy untouched lines, so memoised cart rows keep their identity
   * and only the edited row re-renders on a 200-line bill.
   */
  updateCart: (transform: (cart: readonly CartItem[]) => CartItem[]) => {
    billingSession.setCart(transform(current.cart));
  },

  update: (patch: Partial<CheckoutDraft>) => {
    current = { ...current, ...patch };
    error = null;
    emit();
    persist();
  },

  clear: () => {
    current = fresh();
    error = null;
    emit();
  },

  hasCart: () => current.cart.length > 0,

  flush: async () => {
    await queue;
    if (error) throw error;
  },

  park: async () => {
    await queue;
    if (error) throw error;
    if (current.cart.length) await saveDraft(structuredCloneSafe(current), 'parked');
    current = fresh();
    emit();
  },

  resume: async (draft: CheckoutDraft) => {
    await queue;
    if (error) throw error;
    if (current.cart.length && current.id !== draft.id) await saveDraft(current, 'parked');
    current = structuredCloneSafe(draft);
    error = null;
    emit();
  },

  getError: () => error?.message ?? null,
};

export const useCheckoutDraft = () =>
  useSyncExternalStore(
    billingSession.subscribe,
    billingSession.getSnapshot,
    billingSession.getSnapshot
  );
