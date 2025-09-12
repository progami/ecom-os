import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

// Keep this package framework-agnostic by avoiding Node-specific types.
// Consumers should pass an object like process.env.
export function getConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
