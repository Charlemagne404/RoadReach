import { type Response, Router } from 'express';
import {
  geocodeQuerySchema,
  geocodeResponseSchema,
  reachabilityQuerySchema,
  reachabilityResponseSchema,
  reverseGeocodeQuerySchema,
  reverseGeocodeResponseSchema,
} from '@roadreach/contracts';
import { env } from '../config.js';
import {
  buildDemoReachability,
  reverseDemoLocation,
  searchDemoLocations,
} from '../lib/demo.js';
import { buildBranchTargets, dedupeBranchFeatures } from '../lib/geometry.js';
import {
  fetchIsoDistancePolygon,
  fetchRouteBranch,
  geocodeLocation,
  isGraphHopperConfigError,
  isGraphHopperRequestError,
  reverseGeocodeLocation,
} from '../lib/graphhopper.js';

export const apiRouter = Router();

const hasLiveProvider = Boolean(env.GRAPHHOPPER_API_KEY);

function respondWithError(error: unknown, response: Response) {
  if (isGraphHopperConfigError(error)) {
    return response.status(503).json({ error: error.message });
  }

  if (isGraphHopperRequestError(error)) {
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
    const results = hasLiveProvider ? await geocodeLocation(q) : searchDemoLocations(q);

    response.json(
      geocodeResponseSchema.parse({
        query: q,
        results,
      }),
    );
  } catch (error) {
    respondWithError(error, response);
  }
});

apiRouter.get('/reverse-geocode', async (request, response) => {
  try {
    const { lat, lng } = reverseGeocodeQuerySchema.parse(request.query);
    const location = hasLiveProvider
      ? await reverseGeocodeLocation(lat, lng)
      : reverseDemoLocation(lat, lng);

    response.json(
      reverseGeocodeResponseSchema.parse({
        location,
      }),
    );
  } catch (error) {
    respondWithError(error, response);
  }
});

apiRouter.get('/reachability', async (request, response) => {
  try {
    const { lat, lng, distanceKm, mode } = reachabilityQuerySchema.parse(request.query);
    let polygon;
    let branches;
    let sampledTargetCount;

    if (hasLiveProvider) {
      polygon = await fetchIsoDistancePolygon(lat, lng, distanceKm, mode);
      const targets = buildBranchTargets([lng, lat], polygon, distanceKm);
      const branchResults = await Promise.allSettled(
        targets.map(([targetLng, targetLat]) =>
          fetchRouteBranch(
            { lat, lng },
            { lat: targetLat, lng: targetLng },
            mode,
          ),
        ),
      );

      branches = dedupeBranchFeatures(
        branchResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        ),
      );
      sampledTargetCount = targets.length;
    } else {
      const demoResult = buildDemoReachability(lat, lng, distanceKm, mode);
      polygon = demoResult.polygon;
      branches = demoResult.branches;
      sampledTargetCount = branches.length;
    }

    response.json(
      reachabilityResponseSchema.parse({
        origin: { lat, lng },
        distanceKm,
        mode,
        provider: hasLiveProvider ? 'graphhopper' : 'demo',
        polygon,
        branches,
        meta: {
          branchStrategy: 'sampled-routes',
          sampledTargetCount,
          successfulBranchCount: branches.length,
          generatedAt: new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    respondWithError(error, response);
  }
});
