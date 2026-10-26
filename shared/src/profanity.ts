/**
 * Small UZ/RU/EN profanity filter for nicknames, team names and quiz titles.
 * Two lists: distinctive roots matched anywhere, and short words matched only as whole words
 * (to avoid false positives like "klassik").
 */
const ROOTS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigg',
  'faggot',
  'whore',
  'хуй',
  'хуе',
  'хуё',
  'пизд',
  'ебан',
  'ебат',
  'ёбан',
  'еблан',
  'бляд',
  'блят',
  'сука',
  'мудак',
  'пидор',
  'пидар',
  'гандон',
  'шлюх',
  'jalab',
  'qotoq',
  'onangni',
  'skaman',
  'sikaman',
  'gandon'
];

const WHOLE_WORDS = ['dick', 'sik', 'sikay', 'siktir', 'blyat', 'suka', 'pidor', 'xuy', 'huy', 'qanjiq', 'dalbayob', 'дебил'];

export const RESERVED_NAMES = ['admin', 'administrator', 'uzuz', 'moderator', 'mod', 'host', 'system', 'support'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʻʼ'`]/g, '')
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  const compact = norm.replace(/[\s_.\-]+/g, '');
  if (ROOTS.some((root) => compact.includes(root))) return true;
  const words = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some((w) => WHOLE_WORDS.includes(w));
}

export function isReservedName(text: string): boolean {
  const norm = normalize(text).replace(/[\s_.\-\d]+/g, '');
  return RESERVED_NAMES.includes(norm);
}
