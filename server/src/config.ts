import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  GRAPHHOPPER_API_KEY: z.string().trim().min(1).optional(),
  GRAPHHOPPER_BASE_URL: z.string().url().default('https://graphhopper.com/api/1'),
});

export const env = envSchema.parse({
  PORT: process.env.PORT ?? '8787',
  GRAPHHOPPER_API_KEY: process.env.GRAPHHOPPER_API_KEY,
  GRAPHHOPPER_BASE_URL:
    process.env.GRAPHHOPPER_BASE_URL ?? 'https://graphhopper.com/api/1',
});
