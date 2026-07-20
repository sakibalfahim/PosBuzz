import { z } from 'zod';

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    return v === 'true' || v === '1';
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith('redis://') || v.startsWith('rediss://'),
      'REDIS_URL must start with redis:// (local) or rediss:// (Upstash)',
    ),
  JWT_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().min(1),
  AUTH_ALLOW_REGISTER: boolFromEnv.default(true),
  SEED_DEMO_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
