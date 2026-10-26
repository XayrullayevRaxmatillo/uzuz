import { useCallback, useState } from 'react';
import { KEYS, storage } from './storage';

/** Favorites are stored only in this browser — no account required. */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => storage.get<string[]>(KEYS.favorites, []));
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 200);
      storage.set(KEYS.favorites, next);
      return next;
    });
  }, []);
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
