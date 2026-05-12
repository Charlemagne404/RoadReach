import { env } from '../../config.js';
import { createOpenRouteServiceProvider } from './openrouteservice.js';
import type { GeocodingProvider, ReachabilityService } from './types.js';

function requiresApiKey(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname === 'api.openrouteservice.org';
  } catch {
    return true;
  }
}

function canUseOpenRouteService(baseUrl: string, apiKey?: string) {
  return Boolean(apiKey) || !requiresApiKey(baseUrl);
}

function buildOpenRouteServiceProvider() {
  return createOpenRouteServiceProvider({
    apiKey: env.OPENROUTESERVICE_API_KEY,
    baseUrl: env.OPENROUTESERVICE_BASE_URL,
    branchStrategy: env.REACHABILITY_BRANCH_STRATEGY,
    geocodeBaseUrl:
      env.OPENROUTESERVICE_GEOCODE_BASE_URL ?? env.OPENROUTESERVICE_BASE_URL,
  });
}

export function getGeocodingProvider(): GeocodingProvider | null {
  if (env.GEOCODING_PROVIDER === 'demo') {
    return null;
  }

  const geocodeBaseUrl =
    env.OPENROUTESERVICE_GEOCODE_BASE_URL ?? env.OPENROUTESERVICE_BASE_URL;

  if (!canUseOpenRouteService(geocodeBaseUrl, env.OPENROUTESERVICE_API_KEY)) {
    return null;
  }

  return buildOpenRouteServiceProvider();
}

export function getReachabilityProvider(): ReachabilityService | null {
  if (env.REACHABILITY_PROVIDER === 'demo') {
    return null;
  }

  if (!canUseOpenRouteService(env.OPENROUTESERVICE_BASE_URL, env.OPENROUTESERVICE_API_KEY)) {
    return null;
  }

  return buildOpenRouteServiceProvider();
}
