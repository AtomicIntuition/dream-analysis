import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';

// In development, allow placeholder values for testing
const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SERVICE_URL: z.string().optional(), // For keep-warm self-ping

  // Supabase
  SUPABASE_URL: isDev
    ? z.string().default('https://placeholder.supabase.co')
    : z.string().url(),
  SUPABASE_ANON_KEY: isDev
    ? z.string().default('placeholder-anon-key')
    : z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: isDev
    ? z.string().default('placeholder-service-key')
    : z.string().min(1),

  // Claude API
  ANTHROPIC_API_KEY: isDev
    ? z.string().default('sk-ant-placeholder')
    : z.string().startsWith('sk-ant-'),

  // Stripe
  STRIPE_SECRET_KEY: isDev
    ? z.string().default('sk_test_placeholder')
    : z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: isDev
    ? z.string().default('whsec_placeholder')
    : z.string().startsWith('whsec_'),
  STRIPE_PRICE_ID_MONTHLY: isDev
    ? z.string().default('price_placeholder')
    : z.string().startsWith('price_'),

  // Limits
  FREE_ANALYSES_PER_MONTH: z.string().transform(Number).default('3'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  if (!isDev) {
    process.exit(1);
  }
  console.warn('Running in development mode with placeholder values.');
}

export const env = parsed.success ? parsed.data : {
  PORT: '3001',
  NODE_ENV: 'development' as const,
  FRONTEND_URL: 'http://localhost:5173',
  SERVICE_URL: undefined,
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-key',
  ANTHROPIC_API_KEY: 'sk-ant-placeholder',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  STRIPE_PRICE_ID_MONTHLY: 'price_placeholder',
  FREE_ANALYSES_PER_MONTH: 3,
};
