import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { KEYS, storage } from '../lib/storage';
import { setSoundEnabled } from '../lib/sound';

type Theme = 'dark' | 'light';

interface Settings {
  theme: Theme;
  toggleTheme: () => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  /** true when either the OS or the manual toggle asks for reduced motion */
  motionReduced: boolean;
  sound: boolean;
  setSound: (v: boolean) => void;
}

const Ctx = createContext<Settings | null>(null);

function initialTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function useMediaQuery(q: string): boolean {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [q]);
  return match;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => storage.get(KEYS.reduceMotion, false));
  const [sound, setSoundState] = useState<boolean>(() => storage.get(KEYS.sound, false));
  const osReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0A0F2C' : '#F5F7FF');
    storage.setRaw(KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    storage.set(KEYS.reduceMotion, reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    setSoundEnabled(sound);
    storage.set(KEYS.sound, sound);
  }, [sound]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo<Settings>(
    () => ({
      theme,
      toggleTheme,
      reduceMotion,
      setReduceMotion: setReduceMotionState,
      motionReduced: reduceMotion || osReduced,
      sound,
      setSound: setSoundState
    }),
    [theme, toggleTheme, reduceMotion, osReduced, sound]
  );

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useSettings(): Settings {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings outside provider');
  return v;
}
