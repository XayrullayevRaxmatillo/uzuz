import crypto from 'node:crypto';
import { ROOM_CODE_ALPHABET, randomCode } from '@uzuz/shared';

export const randomInt = (max: number) => crypto.randomInt(max);

/** 256-bit random token, URL-safe. */
export function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function newPublicId(): string {
  return randomCode(10, randomInt, 'abcdefghjkmnpqrstuvwxyz23456789');
}

/** Human-friendly restore code: UZ-XXXX-XXXX */
export function newRestoreCode(): string {
  return `UZ-${randomCode(4, randomInt, ROOM_CODE_ALPHABET)}-${randomCode(4, randomInt, ROOM_CODE_ALPHABET)}`;
}

export function normalizeRestoreCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('UZ') ? raw.slice(2) : raw;
  return `UZ-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
