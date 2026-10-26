import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AdminSession, AdminUser } from '../models/misc';
import { sha256 } from '../utils/crypto';
import { ApiError } from '../utils/http';

export const ADMIN_COOKIE = 'uzuz_admin';
export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

export function adminCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE === 'none' ? 'none' : 'strict',
    maxAge: ADMIN_SESSION_MS,
    path: '/api/v1/admin'
  };
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
    if (!token) throw new ApiError(401, 'ADMIN_AUTH');
    const session = await AdminSession.findOne({ tokenHash: sha256(token) });
    if (!session || session.expiresAt.getTime() < Date.now()) throw new ApiError(401, 'ADMIN_AUTH');
    const admin = await AdminUser.findById(session.admin);
    if (!admin) throw new ApiError(401, 'ADMIN_AUTH');
    req.admin = { id: admin._id.toString(), username: admin.username };
    next();
  } catch (err) {
    next(err);
  }
}
