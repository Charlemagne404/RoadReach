import { type Response, Router } from 'express';
import {
  geocodeQuerySchema,
  geocodeResponseSchema,
  reachabilityQuerySchema,
  reachabilityResponseSchema,
  reverseGeocodeQuerySchema,
  reverseGeocodeResponseSchema,
} from '@roadreach/contracts';
import {
  buildDemoReachability,
  reverseDemoLocation,
  searchDemoLocations,
} from '../lib/demo.js';
import {
  getGeocodingProvider,
  getReachabilityProvider,
} from '../lib/providers/index.js';
import {
  ProviderConfigError,
  ProviderRequestError,
  type BranchStrategy,
} from '../lib/providers/types.js';
import { env } from '../config.js';

export const apiRouter = Router();

const geocodingProvider = getGeocodingProvider();
const reachabilityProvider = getReachabilityProvider();
const cacheTtlMs = env.API_CACHE_TTL_MS;
const geocodeCache = new Map<string, { expiresAt: number; value: unknown }>();
const reverseGeocodeCache = new Map<string, { expiresAt: number; value: unknown }>();
const reachabilityCache = new Map<string, { expiresAt: number; value: unknown }>();

function decimalPlaces(value: number) {
  const text = String(value);
  const [, decimals = ''] = text.split('.');
  return decimals.length;
}

function roundToStep(value: number, step: number) {
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimalPlaces(step)));
}

function buildCoordinateCachePart(value: number) {
  return value.toFixed(env.REACHABILITY_CACHE_COORD_DECIMALS);
}

function buildReachabilityCacheKey(
  lat: number,
  lng: number,
  distanceKm: number,
  mode: string,
) {
  return [
    buildCoordinateCachePart(lat),
    buildCoordinateCachePart(lng),
    roundToStep(distanceKm, env.REACHABILITY_CACHE_DISTANCE_STEP_KM),
    mode,
  ].join(':');
}

function readCache<T>(cache: Map<string, { expiresAt: number; value: unknown }>, key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

function writeCache(
  cache: Map<string, { expiresAt: number; value: unknown }>,
  key: string,
  value: unknown,
) {
  cache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    value,
  });
}

function shouldFallbackToDemoReachability(error: unknown) {
  return error instanceof ProviderConfigError || error instanceof ProviderRequestError;
}

function respondWithError(error: unknown, response: Response) {
  if (error instanceof ProviderConfigError) {
    return response.status(503).json({ error: error.message });
  }

  if (error instanceof ProviderRequestError) {
    return response.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof Error) {
    return response.status(500).json({ error: error.message });
  }

  return response.status(500).json({ error: 'Unexpected server error.' });
}

apiRouter.get('/health', (_request, response) => {
  response.json({ ok: true });
});

apiRouter.get('/geocode', async (request, response) => {
  try {
    const { q } = geocodeQuerySchema.parse(request.query);
    const cacheKey = q.trim().toLowerCase();
    const cached = readCache<unknown>(geocodeCache, cacheKey);

    if (cached) {
      response.json(geocodeResponseSchema.parse(cached));
      return;
    }

    const results = geocodingProvider
      ? await geocodingProvider.geocode(q)
      : searchDemoLocations(q);

    const payload = geocodeResponseSchema.parse({
      query: q,
      results,
    });
    writeCache(geocodeCache, cacheKey, payload);
    response.json(payload);
  } catch (error) {
    respondWithError(error, response);
  }
});

apiRouter.get('/reverse-geocode', async (request, response) => {
  try {
    const { lat, lng } = reverseGeocodeQuerySchema.parse(request.query);
    const cacheKey = `${buildCoordinateCachePart(lat)}:${buildCoordinateCachePart(lng)}`;
    const cached = readCache<unknown>(reverseGeocodeCache, cacheKey);

    if (cached) {
      response.json(reverseGeocodeResponseSchema.parse(cached));
      return;
    }

    const location = geocodingProvider
      ? await geocodingProvider.reverseGeocode(lat, lng)
      : reverseDemoLocation(lat, lng);

    const payload = reverseGeocodeResponseSchema.parse({
      location,
    });
    writeCache(reverseGeocodeCache, cacheKey, payload);
    response.json(payload);
  } catch (error) {
    respondWithError(error, response);
  }
});

apiRouter.get('/reachability', async (request, response) => {
  try {
    const { lat, lng, distanceKm, mode } = reachabilityQuerySchema.parse(request.query);
    const cacheKey = buildReachabilityCacheKey(lat, lng, distanceKm, mode);
    const cached = readCache<unknown>(reachabilityCache, cacheKey);

    if (cached) {
      response.json(reachabilityResponseSchema.parse(cached));
      return;
    }

    let polygon;
    let branches;
    let branchStrategy: BranchStrategy;
    let sampledTargetCount;
    let provider: 'openrouteservice' | 'demo' = reachabilityProvider
      ? reachabilityProvider.name
      : 'demo';

    if (reachabilityProvider) {
      try {
        const result = await reachabilityProvider.reachability(lat, lng, distanceKm, mode);
        polygon = result.polygon;
        branches = result.branches;
        branchStrategy = result.branchStrategy;
        sampledTargetCount = result.sampledTargetCount;
      } catch (error) {
        if (!shouldFallbackToDemoReachability(error)) {
          throw error;
        }

        const demoResult = buildDemoReachability(lat, lng, distanceKm, mode);
        polygon = demoResult.polygon;
        branches = demoResult.branches;
        branchStrategy = 'local-branches';
        sampledTargetCount = branches.length;
        provider = 'demo';
      }
    } else {
      const demoResult = buildDemoReachability(lat, lng, distanceKm, mode);
      polygon = demoResult.polygon;
      branches = demoResult.branches;
      branchStrategy = 'local-branches';
      sampledTargetCount = branches.length;
    }

    const payload = reachabilityResponseSchema.parse({
      origin: { lat, lng },
      distanceKm,
      mode,
      provider,
      polygon,
      branches,
      meta: {
        branchStrategy,
        sampledTargetCount,
        successfulBranchCount: branches.length,
        generatedAt: new Date().toISOString(),
      },
    });
    writeCache(reachabilityCache, cacheKey, payload);
    response.json(payload);
  } catch (error) {
    respondWithError(error, response);
  }
});
