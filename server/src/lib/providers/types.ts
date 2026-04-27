import type {
  GeocodeResult,
  ReachabilityBranchFeature,
  ReachabilityPolygonFeature,
  ReachabilityProvider,
  TravelMode,
} from '@roadreach/contracts';

export class ProviderConfigError extends Error {}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export type LiveProviderName = Exclude<ReachabilityProvider, 'demo'>;

export type ReachabilityResult = {
  polygon: ReachabilityPolygonFeature;
  branches: ReachabilityBranchFeature[];
  sampledTargetCount: number;
};

export type GeocodingProvider = {
  name: LiveProviderName;
  geocode(query: string): Promise<GeocodeResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null>;
};

export type ReachabilityService = {
  name: LiveProviderName;
  reachability(lat: number, lng: number, distanceKm: number, mode: TravelMode): Promise<ReachabilityResult>;
};
