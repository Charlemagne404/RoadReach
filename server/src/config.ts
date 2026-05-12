import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const providerSchema = z.enum(['openrouteservice', 'demo']);
const branchStrategySchema = z.enum(['local-branches', 'sampled-routes', 'none']);

const envSchema = z.object({
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  GEOCODING_PROVIDER: providerSchema.default('openrouteservice'),
  REACHABILITY_PROVIDER: providerSchema.default('openrouteservice'),
  REACHABILITY_BRANCH_STRATEGY: branchStrategySchema.default('local-branches'),
  API_CACHE_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  REACHABILITY_CACHE_COORD_DECIMALS: z.coerce.number().int().min(3).max(6).default(4),
  REACHABILITY_CACHE_DISTANCE_STEP_KM: z.coerce.number().positive().default(0.1),
  OPENROUTESERVICE_API_KEY: z.string().trim().min(1).optional(),
  OPENROUTESERVICE_BASE_URL: z.string().url().default('https://api.openrouteservice.org'),
  OPENROUTESERVICE_GEOCODE_BASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  HOST: process.env.HOST ?? '127.0.0.1',
  PORT: process.env.PORT ?? '8787',
  GEOCODING_PROVIDER: process.env.GEOCODING_PROVIDER ?? 'openrouteservice',
  REACHABILITY_PROVIDER: process.env.REACHABILITY_PROVIDER ?? 'openrouteservice',
  REACHABILITY_BRANCH_STRATEGY:
    process.env.REACHABILITY_BRANCH_STRATEGY ?? 'local-branches',
  API_CACHE_TTL_MS: process.env.API_CACHE_TTL_MS,
  REACHABILITY_CACHE_COORD_DECIMALS:
    process.env.REACHABILITY_CACHE_COORD_DECIMALS,
  REACHABILITY_CACHE_DISTANCE_STEP_KM:
    process.env.REACHABILITY_CACHE_DISTANCE_STEP_KM,
  OPENROUTESERVICE_API_KEY: process.env.OPENROUTESERVICE_API_KEY,
  OPENROUTESERVICE_BASE_URL:
    process.env.OPENROUTESERVICE_BASE_URL ?? 'https://api.openrouteservice.org',
  OPENROUTESERVICE_GEOCODE_BASE_URL:
    process.env.OPENROUTESERVICE_GEOCODE_BASE_URL,
});
