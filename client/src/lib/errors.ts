import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** Map any server/socket error code to a localized, actionable message. */
export function errorMessage(t: TFunction, err: unknown): string {
  const code = err instanceof ApiError ? err.code : typeof err === 'string' ? err : (err as { code?: string })?.code;
  if (code) {
    const key = `errors.${code}`;
    const msg = t(key);
    if (msg !== key) return msg;
  }
  return t('errors.INTERNAL');
}
