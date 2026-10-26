import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uz from './locales/uz.json';
import ru from './locales/ru.json';
import en from './locales/en.json';
import { KEYS, storage } from './lib/storage';
import type { Lang } from '@uzuz/shared';

export const LANG_LABELS: Record<Lang, string> = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' };

function detect(): Lang {
  const saved = storage.getRaw(KEYS.lang);
  if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  const nav = (navigator.languages ?? [navigator.language]).map((l) => l.toLowerCase().slice(0, 2));
  for (const l of nav) {
    if (l === 'uz') return 'uz';
    if (l === 'ru') return 'ru';
    if (l === 'en') return 'en';
  }
  return 'uz';
}

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: detect(),
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
  returnNull: false
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  storage.setRaw(KEYS.lang, lng);
});

export function currentLang(): Lang {
  const l = i18n.language as Lang;
  return l === 'ru' || l === 'en' ? l : 'uz';
}

const LOCALES: Record<Lang, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-US' };

// Browser ICU data for Uzbek is often incomplete, so Uzbek numbers and dates are formatted explicitly.
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

export function formatNumber(n: number): string {
  try {
    // Uzbek groups thousands with a space, like Russian.
    return new Intl.NumberFormat(currentLang() === 'uz' ? 'ru-RU' : LOCALES[currentLang()]).format(n);
  } catch {
    return String(n);
  }
}

export function formatDate(d: string | number | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  if (currentLang() === 'uz') {
    const dt = new Date(d);
    const date = `${dt.getFullYear()}-yil ${dt.getDate()}-${UZ_MONTHS[dt.getMonth()]}`;
    if (!opts.timeStyle) return date;
    return `${date}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }
  try {
    return new Intl.DateTimeFormat(LOCALES[currentLang()], opts).format(new Date(d));
  } catch {
    return new Date(d).toLocaleString();
  }
}

export function relativeTime(d: string | number | Date): string {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];
  // Some browsers ship incomplete Uzbek ICU data ("-3 d"), so Uzbek is formatted by hand.
  if (currentLang() === 'uz') {
    const UZ: Record<string, string> = { year: 'yil', month: 'oy', day: 'kun', hour: 'soat', minute: 'daqiqa' };
    for (const [unit, sec] of units) {
      if (abs >= sec) {
        const n = Math.round(abs / sec);
        return diff < 0 ? `${n} ${UZ[unit]} oldin` : `${n} ${UZ[unit]}dan keyin`;
      }
    }
    return 'hozirgina';
  }
  try {
    const rtf = new Intl.RelativeTimeFormat(LOCALES[currentLang()], { numeric: 'auto' });
    for (const [unit, sec] of units) if (abs >= sec) return rtf.format(Math.round(diff / sec), unit);
    return rtf.format(0, 'minute');
  } catch {
    return formatDate(d);
  }
}

export default i18n;
