import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TEAM_CODE_LENGTH } from './constants';

export type RandomInt = (maxExclusive: number) => number;

export function randomCode(length: number, randomInt: RandomInt, alphabet = ROOM_CODE_ALPHABET): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export function generateRoomCode(randomInt: RandomInt): string {
  return randomCode(ROOM_CODE_LENGTH, randomInt);
}

export function generateTeamCode(randomInt: RandomInt): string {
  return `T-${randomCode(TEAM_CODE_LENGTH, randomInt)}`;
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const ROOM_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export function isValidRoomCode(code: string): boolean {
  return ROOM_RE.test(code);
}

export function normalizeTeamCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('T') && raw.length === TEAM_CODE_LENGTH + 1 ? raw.slice(1) : raw;
  return `T-${body}`;
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h'
};

export function slugify(input: string): string {
  const translit = input
    .toLowerCase()
    .split('')
    .map((c) => CYR[c] ?? c)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʻʼ'`]/g, '');
  const slug = translit
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'quiz';
}
