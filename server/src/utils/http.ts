import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import mongoose from 'mongoose';
import type { ErrorCode } from '@uzuz/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message?: string,
    public details?: unknown
  ) {
    super(message ?? code);
  }
}

export const notFound = (code: ErrorCode = 'NOT_FOUND') => new ApiError(404, code);
export const forbidden = (code: ErrorCode = 'FORBIDDEN') => new ApiError(403, code);
export const badRequest = (code: ErrorCode = 'BAD_REQUEST', details?: unknown) => new ApiError(400, code, undefined, details);
export const conflict = (code: ErrorCode) => new ApiError(409, code);

/** Express 4 does not catch async errors — wrap every async handler. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION', 'Validation failed', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}

export function isObjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id) && mongoose.isValidObjectId(id);
}

export function requireObjectId(id: unknown, code: ErrorCode = 'NOT_FOUND'): string {
  if (!isObjectId(id)) throw notFound(code);
  return id;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Validation failed', details: err.issues } });
    return;
  }
  const e = err as { type?: string; status?: number; code?: number };
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'BAD_REQUEST', message: 'Payload too large' } });
    return;
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } });
    return;
  }
  if (e?.code === 11000) {
    res.status(409).json({ error: { code: 'BAD_REQUEST', message: 'Duplicate' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
