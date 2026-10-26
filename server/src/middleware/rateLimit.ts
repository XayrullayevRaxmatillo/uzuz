import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

const handler = (_req: Request, res: Response) => {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' } });
};

/** Per-IP limiter for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler
});

/** Per-session limiter for expensive or abusable actions. Falls back to IP. */
export function actionLimiter(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => (req.guest ? `s:${req.guest._id.toString()}` : `ip:${req.ip ?? 'unknown'}`),
    handler
  });
}

/** Per-IP limiter (room code lookups — anti brute force; restore; admin login). */
export function ipLimiter(limit: number, windowMs: number) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler });
}
