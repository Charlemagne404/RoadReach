import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) {
        return initialValue;
      }

      const parsed = JSON.parse(stored) as T | null;
      return parsed ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage write errors so the explorer remains usable in private mode.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
