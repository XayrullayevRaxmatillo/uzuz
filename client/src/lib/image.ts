import { api } from './api';

const MAX_INPUT = 2 * 1024 * 1024;
const MAX_SIDE = 1200;

/**
 * Resize and re-encode an image in the browser before upload. Drawing to a canvas drops EXIF
 * metadata (incl. GPS). Returns the stored image path.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('type');
  if (file.size > MAX_INPUT) throw new Error('size');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('canvas');
  c.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/webp', quality);
  // Safari < 16 can't encode WebP and silently returns PNG — fall back to JPEG.
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 680_000 && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL(dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg', quality);
  }
  if (dataUrl.length > 700_000) throw new Error('size');

  const res = await api<{ url: string }>('/images', { method: 'POST', body: { data: dataUrl } });
  return res.url;
}
