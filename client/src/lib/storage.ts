/** localStorage wrapper that never throws (private mode, blocked storage). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  getRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setRaw(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
};

export const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
};

export const KEYS = {
  lang: 'uzuz_lang',
  theme: 'uzuz_theme',
  reduceMotion: 'uzuz_reduce_motion',
  sound: 'uzuz_sound',
  profile: 'uzuz_profile',
  favorites: 'uzuz_favorites',
  editKeys: 'uzuz_edit_keys',
  draft: 'uzuz_draft',
  teamPrefs: 'uzuz_team_prefs'
} as const;

export interface LocalProfile {
  nickname: string;
  avatar: number;
  color: number;
}
