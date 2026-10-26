import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: bool,
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  SERVE_CLIENT: z.enum(['auto', 'true', 'false']).default('auto')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === 'production' && !data.MONGODB_URI) {
  console.error('❌ MONGODB_URI is required in production.');
  process.exit(1);
}
if (data.COOKIE_SAMESITE === 'none' && !data.COOKIE_SECURE) {
  console.error('❌ COOKIE_SAMESITE=none requires COOKIE_SECURE=true.');
  process.exit(1);
}

export const env = {
  ...data,
  isProd: data.NODE_ENV === 'production',
  clientOrigins: data.CLIENT_URL.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
};
