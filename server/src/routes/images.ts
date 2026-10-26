import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { Image } from '../models/misc';
import { asyncHandler, badRequest, notFound, parse, requireObjectId } from '../utils/http';
import { actionLimiter } from '../middleware/rateLimit';

export const imagesRouter = Router();

const MAX_BYTES = 512 * 1024;

/** Detect the real file type from magic bytes — never trust the client-declared type. */
function sniff(buf: Buffer): 'image/webp' | 'image/png' | 'image/jpeg' | null {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

/**
 * Upload: the client resizes to ≤1200px and re-encodes as WebP via canvas (which drops EXIF),
 * then sends a base64 data URL. The server verifies type and size.
 */
imagesRouter.post(
  '/',
  express.json({ limit: '800kb' }),
  actionLimiter(60, 60 * 60_000),
  asyncHandler(async (req, res) => {
    const { data } = parse(z.object({ data: z.string().max(760_000) }).strict(), req.body);
    const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(data);
    if (!match) throw badRequest('IMAGE_INVALID');
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length === 0 || buf.length > MAX_BYTES) throw badRequest('IMAGE_INVALID');
    const mime = sniff(buf);
    if (!mime) throw badRequest('IMAGE_INVALID');
    const img = await Image.create({ data: buf, mime, size: buf.length, owner: req.guest._id });
    res.status(201).json({ url: `/api/v1/images/${img._id.toString()}` });
  })
);

imagesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireObjectId(req.params.id);
    const img = await Image.findById(id).lean();
    if (!img) throw notFound();
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(img.data as unknown as Buffer));
  })
);
