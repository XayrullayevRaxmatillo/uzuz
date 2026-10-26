import { useEffect, useState } from 'react';
import type { CategoryDTO } from '@uzuz/shared';
import { api } from './api';

const FALLBACK: Record<string, { icon: string; color: string }> = {
  it: { icon: '💻', color: '#7C3AED' },
  math: { icon: '➗', color: '#4F46E5' },
  english: { icon: '🔤', color: '#0EA5E9' },
  science: { icon: '🔬', color: '#22C55E' },
  history: { icon: '🏛️', color: '#F59E0B' },
  geography: { icon: '🌍', color: '#14B8A6' },
  general: { icon: '💡', color: '#FF6B6B' }
};

let cache: CategoryDTO[] | null = null;
let inflight: Promise<CategoryDTO[]> | null = null;

export function loadCategories(): Promise<CategoryDTO[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api<{ items: CategoryDTO[] }>('/categories')
      .then((r) => {
        cache = r.items;
        for (const c of r.items) FALLBACK[c.slug] = { icon: c.icon, color: c.color };
        return r.items;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCategories(): CategoryDTO[] | null {
  const [cats, setCats] = useState<CategoryDTO[] | null>(cache);
  useEffect(() => {
    if (!cache) loadCategories().then(setCats).catch(() => setCats([]));
  }, []);
  return cats;
}

export function categoryMeta(slug: string): { icon: string; color: string } {
  return FALLBACK[slug] ?? { icon: '✨', color: '#7C3AED' };
}
