import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { AppState } from 'react-native';

const listeners = new Set<() => void>();

export const notifyDataChanged = () => listeners.forEach((listener) => listener());

export const subscribeData = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useLiveData = (load: () => void) => {
  useFocusEffect(
    useCallback(() => {
      load();

      const unsubscribe = subscribeData(load);

      const app = AppState.addEventListener('change', (state) => {
        if (state === 'active') load();
      });

      const timer = setInterval(load, 60000);

      return () => {
        unsubscribe();
        app.remove();
        clearInterval(timer);
      };
    }, [load])
  );
};
