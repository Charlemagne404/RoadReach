import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const providerSchema = z.enum(['openrouteservice', 'demo']);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  GEOCODING_PROVIDER: providerSchema.default('openrouteservice'),
  REACHABILITY_PROVIDER: providerSchema.default('openrouteservice'),
  OPENROUTESERVICE_API_KEY: z.string().trim().min(1).optional(),
  OPENROUTESERVICE_BASE_URL: z.string().url().default('https://api.openrouteservice.org'),
  OPENROUTESERVICE_GEOCODE_BASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  PORT: process.env.PORT ?? '8787',
  GEOCODING_PROVIDER: process.env.GEOCODING_PROVIDER ?? 'openrouteservice',
  REACHABILITY_PROVIDER: process.env.REACHABILITY_PROVIDER ?? 'openrouteservice',
  OPENROUTESERVICE_API_KEY: process.env.OPENROUTESERVICE_API_KEY,
  OPENROUTESERVICE_BASE_URL:
    process.env.OPENROUTESERVICE_BASE_URL ?? 'https://api.openrouteservice.org',
  OPENROUTESERVICE_GEOCODE_BASE_URL:
    process.env.OPENROUTESERVICE_GEOCODE_BASE_URL,
});
