import {
  type GeocodeResult,
  type ReachabilityBranchFeature,
  type ReachabilityPolygonFeature,
  type TravelMode,
  branchFeatureSchema,
  polygonFeatureSchema,
} from '@roadreach/contracts';
import { env } from '../config.js';

const graphHopperProfiles: Record<TravelMode, string> = {
  driving: 'car',
  cycling: 'bike',
  walking: 'foot',
};

type GraphHopperGeocodeHit = {
  osm_id?: string | number;
  osm_type?: string;
  name?: string;
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  point: {
    lat: number;
    lng: number;
  };
};

class GraphHopperConfigError extends Error {}

class GraphHopperRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

function requireApiKey() {
  if (!env.GRAPHHOPPER_API_KEY) {
    throw new GraphHopperConfigError(
      'Missing GRAPHHOPPER_API_KEY. Add it to your .env file to enable geocoding and reachability.',
    );
  }

  return env.GRAPHHOPPER_API_KEY;
}

async function requestGraphHopper<T>(path: string, params: URLSearchParams) {
  params.set('key', requireApiKey());

  const response = await fetch(`${env.GRAPHHOPPER_BASE_URL}${path}?${params.toString()}`);
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    hints?: { message?: string }[];
  } & T;

  if (!response.ok) {
    const message =
      payload.message ??
      payload.hints?.[0]?.message ??
      'GraphHopper request failed.';

    throw new GraphHopperRequestError(message, response.status);
  }

  return payload;
}

function buildLocationLabel(hit: GraphHopperGeocodeHit) {
  const primaryName =
    hit.name ?? hit.street ?? [hit.housenumber, hit.street].filter(Boolean).join(' ');
  const locality = hit.city ?? hit.state;

  return [primaryName, locality, hit.country].filter(Boolean).join(', ');
}

function mapGeocodeHit(hit: GraphHopperGeocodeHit): GeocodeResult {
  const name = hit.name ?? hit.street ?? 'Dropped pin';
  const label = buildLocationLabel(hit) || name;

  return {
    id: String(hit.osm_id ?? `${hit.point.lat}:${hit.point.lng}`),
    name,
    label,
    lat: hit.point.lat,
    lng: hit.point.lng,
    country: hit.country,
    region: hit.state,
    locality: hit.city ?? hit.postcode,
  };
}

export function isGraphHopperConfigError(error: unknown): error is GraphHopperConfigError {
  return error instanceof GraphHopperConfigError;
}

export function isGraphHopperRequestError(error: unknown): error is GraphHopperRequestError {
  return error instanceof GraphHopperRequestError;
}

export async function geocodeLocation(query: string) {
  const params = new URLSearchParams({
    q: query,
    limit: '5',
    locale: 'en',
  });

  const response = await requestGraphHopper<{ hits?: GraphHopperGeocodeHit[] }>(
    '/geocode',
    params,
  );

  return (response.hits ?? []).map(mapGeocodeHit);
}

export async function reverseGeocodeLocation(lat: number, lng: number) {
  const params = new URLSearchParams({
    reverse: 'true',
    point: `${lat},${lng}`,
    locale: 'en',
  });

  const response = await requestGraphHopper<{ hits?: GraphHopperGeocodeHit[] }>(
    '/geocode',
    params,
  );

  const hit = response.hits?.[0];
  return hit ? mapGeocodeHit(hit) : null;
}

export async function fetchIsoDistancePolygon(
  lat: number,
  lng: number,
  distanceKm: number,
  mode: TravelMode,
) {
  const params = new URLSearchParams({
    point: `${lat},${lng}`,
    profile: graphHopperProfiles[mode],
    distance_limit: String(Math.round(distanceKm * 1000)),
  });

  const response = await requestGraphHopper<{
    polygons?: ReachabilityPolygonFeature[];
  }>('/isochrone', params);

  const polygon = response.polygons?.[0];

  if (!polygon) {
    throw new GraphHopperRequestError('No reachable polygon was returned.', 502);
  }

  return polygonFeatureSchema.parse(polygon);
}

export async function fetchRouteBranch(
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number },
  mode: TravelMode,
) {
  const params = new URLSearchParams({
    profile: graphHopperProfiles[mode],
    points_encoded: 'false',
    instructions: 'false',
    calc_points: 'true',
  });

  params.append('point', `${origin.lat},${origin.lng}`);
  params.append('point', `${target.lat},${target.lng}`);

  const response = await requestGraphHopper<{
    paths?: Array<{
      points?: ReachabilityBranchFeature['geometry'];
    }>;
  }>('/route', params);

  const geometry = response.paths?.[0]?.points;

  if (!geometry) {
    throw new GraphHopperRequestError('No branch route was returned.', 502);
  }

  return branchFeatureSchema.parse({
    type: 'Feature',
    properties: null,
    geometry,
  });
}
