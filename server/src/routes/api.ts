import { type Response, Router } from 'express';
import {
  geocodeQuerySchema,
  geocodeResponseSchema,
  reachabilityQuerySchema,
  reachabilityResponseSchema,
  reverseGeocodeQuerySchema,
  reverseGeocodeResponseSchema,
} from '@roadreach/contracts';
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
    const results = await geocodeLocation(q);

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
    const location = await reverseGeocodeLocation(lat, lng);

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
    const polygon = await fetchIsoDistancePolygon(lat, lng, distanceKm, mode);
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

    const branches = dedupeBranchFeatures(
      branchResults.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      ),
    );

    response.json(
      reachabilityResponseSchema.parse({
        origin: { lat, lng },
        distanceKm,
        mode,
        provider: 'graphhopper',
        polygon,
        branches,
        meta: {
          branchStrategy: 'sampled-routes',
          sampledTargetCount: targets.length,
          successfulBranchCount: branches.length,
          generatedAt: new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    respondWithError(error, response);
  }
});
