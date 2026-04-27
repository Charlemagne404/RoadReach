import {
  type GeocodeResult,
  type ReachabilityBranchFeature,
  type ReachabilityPolygonFeature,
  type TravelMode,
  branchFeatureSchema,
  polygonFeatureSchema,
} from '@roadreach/contracts';
import { buildBranchTargets, dedupeBranchFeatures } from '../geometry.js';
import {
  type GeocodingProvider,
  ProviderRequestError,
  type ReachabilityService,
} from './types.js';

const orsProfiles: Record<TravelMode, string> = {
  driving: 'driving-car',
  cycling: 'cycling-regular',
  walking: 'foot-walking',
};

type OpenRouteServiceOptions = {
  apiKey?: string;
  baseUrl: string;
  geocodeBaseUrl: string;
};

type OrsFeatureCollection<T> = {
  features?: T[];
  error?: { code?: number; message?: string };
  message?: string;
};

type OrsGeocodeFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    id?: string;
    gid?: string;
    label?: string;
    name?: string;
    country?: string;
    region?: string;
    county?: string;
    locality?: string;
    borough?: string;
    postalcode?: string;
    street?: string;
    housenumber?: string;
  };
};

type OrsRouteFeature = {
  geometry?: ReachabilityBranchFeature['geometry'];
};

function createHeaders(apiKey?: string, hasBody = false) {
  const headers = new Headers({
    Accept: 'application/json, application/geo+json, */*',
  });

  if (apiKey) {
    headers.set('Authorization', apiKey);
  }

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function parseJson(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    error?: { code?: number; message?: string };
    message?: string;
  };
}

function buildErrorMessage(payload: { error?: { message?: string }; message?: string }) {
  return payload.error?.message ?? payload.message ?? 'Provider request failed.';
}

function mapGeocodeFeature(feature: OrsGeocodeFeature): GeocodeResult | null {
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const [lng, lat] = coordinates;
  const properties = feature.properties ?? {};
  const name = properties.name ?? properties.street ?? 'Dropped pin';
  const label =
    properties.label ??
    [name, properties.locality ?? properties.county ?? properties.region, properties.country]
      .filter(Boolean)
      .join(', ');

  return {
    id: String(properties.id ?? properties.gid ?? `${lat}:${lng}`),
    name,
    label: label || name,
    lat,
    lng,
    country: properties.country,
    region: properties.region ?? properties.county,
    locality: properties.locality ?? properties.borough ?? properties.postalcode,
  };
}

export function createOpenRouteServiceProvider(
  options: OpenRouteServiceOptions,
): GeocodingProvider & ReachabilityService {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const geocodeBaseUrl = options.geocodeBaseUrl.replace(/\/+$/, '');

  async function geocode(query: string) {
    const url = new URL('/geocode/search', geocodeBaseUrl);
    url.searchParams.set('text', query);
    url.searchParams.set('size', '5');

    if (options.apiKey) {
      url.searchParams.set('api_key', options.apiKey);
    }

    const response = await fetch(url, {
      headers: createHeaders(options.apiKey),
    });
    const payload = (await parseJson(response)) as OrsFeatureCollection<OrsGeocodeFeature>;

    if (!response.ok) {
      throw new ProviderRequestError(buildErrorMessage(payload), response.status);
    }

    return (payload.features ?? []).flatMap((feature) => {
      const location = mapGeocodeFeature(feature);
      return location ? [location] : [];
    });
  }

  async function reverseGeocode(lat: number, lng: number) {
    const url = new URL('/geocode/reverse', geocodeBaseUrl);
    url.searchParams.set('point.lon', String(lng));
    url.searchParams.set('point.lat', String(lat));
    url.searchParams.set('size', '1');

    if (options.apiKey) {
      url.searchParams.set('api_key', options.apiKey);
    }

    const response = await fetch(url, {
      headers: createHeaders(options.apiKey),
    });
    const payload = (await parseJson(response)) as OrsFeatureCollection<OrsGeocodeFeature>;

    if (!response.ok) {
      throw new ProviderRequestError(buildErrorMessage(payload), response.status);
    }

    const location = payload.features?.[0] ? mapGeocodeFeature(payload.features[0]) : null;
    return location ?? null;
  }

  async function fetchIsochrone(
    lat: number,
    lng: number,
    distanceKm: number,
    mode: TravelMode,
  ) {
    const response = await fetch(`${baseUrl}/v2/isochrones/${orsProfiles[mode]}`, {
      method: 'POST',
      headers: createHeaders(options.apiKey, true),
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [Math.round(distanceKm * 1000)],
        range_type: 'distance',
      }),
    });
    const payload = (await parseJson(response)) as OrsFeatureCollection<ReachabilityPolygonFeature>;

    if (!response.ok) {
      throw new ProviderRequestError(buildErrorMessage(payload), response.status);
    }

    const polygon = payload.features?.[0];

    if (!polygon) {
      throw new ProviderRequestError('No reachable polygon was returned.', 502);
    }

    return polygonFeatureSchema.parse(polygon);
  }

  async function fetchRouteBranch(
    origin: { lat: number; lng: number },
    target: { lat: number; lng: number },
    mode: TravelMode,
  ) {
    const response = await fetch(`${baseUrl}/v2/directions/${orsProfiles[mode]}/geojson`, {
      method: 'POST',
      headers: createHeaders(options.apiKey, true),
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [target.lng, target.lat],
        ],
        instructions: false,
      }),
    });
    const payload = (await parseJson(response)) as OrsFeatureCollection<OrsRouteFeature>;

    if (!response.ok) {
      throw new ProviderRequestError(buildErrorMessage(payload), response.status);
    }

    const geometry = payload.features?.[0]?.geometry;

    if (!geometry) {
      throw new ProviderRequestError('No branch route was returned.', 502);
    }

    return branchFeatureSchema.parse({
      type: 'Feature',
      properties: null,
      geometry,
    });
  }

  async function reachability(lat: number, lng: number, distanceKm: number, mode: TravelMode) {
    const polygon = await fetchIsochrone(lat, lng, distanceKm, mode);
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

    return {
      polygon,
      branches: dedupeBranchFeatures(
        branchResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
      ),
      sampledTargetCount: targets.length,
    };
  }

  return {
    name: 'openrouteservice',
    geocode,
    reverseGeocode,
    reachability,
  };
}
