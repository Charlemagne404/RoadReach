import type {
  GeocodeResult,
  ReachabilityProvider,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';

type LonLat = [number, number];

export type MapTheme = 'night' | 'atlas' | 'light';
export type SiteTheme = 'dark' | 'light';

export type SavedScenario = {
  id: string;
  name: string;
  location: GeocodeResult;
  distanceKm: number;
  mode: TravelMode;
  createdAt: string;
};

export type ReachabilityInsights = {
  areaKm2: number;
  branchCount: number;
  sampledCount: number;
  totalBranchKm: number;
  longestBranchKm: number;
  averageBranchKm: number;
};

export type DistancePreset = {
  label: string;
  value: number;
};

export type DistanceConfig = {
  min: number;
  max: number;
  step: number;
  presets: DistancePreset[];
};

const WALKING_SPEED_KMH = 4.8;

export const travelModes: TravelMode[] = ['walking', 'cycling', 'driving'];

export const mapThemes: Array<{ id: MapTheme; label: string; caption: string }> = [
  { id: 'night', label: 'Night', caption: 'high contrast' },
  { id: 'atlas', label: 'Atlas', caption: 'road detail' },
  { id: 'light', label: 'Light', caption: 'clean print look' },
];

export const featuredOrigins: GeocodeResult[] = [
  {
    id: 'stockholm-se',
    name: 'Stockholm',
    label: 'Stockholm, Sweden',
    lat: 59.3293,
    lng: 18.0686,
    country: 'Sweden',
    region: 'Stockholm County',
    locality: 'Stockholm',
  },
  {
    id: 'copenhagen-dk',
    name: 'Copenhagen',
    label: 'Copenhagen, Denmark',
    lat: 55.6761,
    lng: 12.5683,
    country: 'Denmark',
    region: 'Capital Region',
    locality: 'Copenhagen',
  },
  {
    id: 'berlin-de',
    name: 'Berlin',
    label: 'Berlin, Germany',
    lat: 52.52,
    lng: 13.405,
    country: 'Germany',
    region: 'Berlin',
    locality: 'Berlin',
  },
  {
    id: 'barcelona-es',
    name: 'Barcelona',
    label: 'Barcelona, Spain',
    lat: 41.3874,
    lng: 2.1686,
    country: 'Spain',
    region: 'Catalonia',
    locality: 'Barcelona',
  },
  {
    id: 'new-york-us',
    name: 'New York',
    label: 'New York City, United States',
    lat: 40.7128,
    lng: -74.006,
    country: 'United States',
    region: 'New York',
    locality: 'New York City',
  },
  {
    id: 'tokyo-jp',
    name: 'Tokyo',
    label: 'Tokyo, Japan',
    lat: 35.6764,
    lng: 139.65,
    country: 'Japan',
    region: 'Tokyo',
    locality: 'Tokyo',
  },
];

const distanceConfigs: Record<TravelMode, DistanceConfig> = {
  walking: {
    min: 0.5,
    max: 12,
    step: 0.1,
    presets: [
      { label: '10 min', value: 0.8 },
      { label: '20 min', value: 1.6 },
      { label: '30 min', value: 2.4 },
      { label: '45 min', value: 3.6 },
      { label: '60 min', value: 4.8 },
    ],
  },
  cycling: {
    min: 1,
    max: 80,
    step: 0.1,
    presets: [
      { label: '5 km', value: 5 },
      { label: '15 km', value: 15 },
      { label: '25 km', value: 25 },
      { label: '40 km', value: 40 },
      { label: '60 km', value: 60 },
    ],
  },
  driving: {
    min: 1,
    max: 250,
    step: 0.1,
    presets: [
      { label: '15 km', value: 15 },
      { label: '40 km', value: 40 },
      { label: '80 km', value: 80 },
      { label: '140 km', value: 140 },
      { label: '250 km', value: 250 },
    ],
  },
};

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function segmentLengthKm(a: LonLat, b: LonLat) {
  const lat1 = degreesToRadians(a[1]);
  const lat2 = degreesToRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = degreesToRadians(b[0] - a[0]);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * 6371 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function ringAreaKm2(ring: LonLat[]) {
  if (ring.length < 3) {
    return 0;
  }

  const averageLat =
    ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const metersPerDegreeLng = 111_320 * Math.cos(degreesToRadians(averageLat));
  const metersPerDegreeLat = 110_540;

  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [lng1, lat1] = ring[index];
    const [lng2, lat2] = ring[(index + 1) % ring.length];
    const x1 = lng1 * metersPerDegreeLng;
    const y1 = lat1 * metersPerDegreeLat;
    const x2 = lng2 * metersPerDegreeLng;
    const y2 = lat2 * metersPerDegreeLat;
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2) / 1_000_000;
}

export function calculateReachabilityInsights(result: ReachabilityResponse): ReachabilityInsights {
  const branchLengths = result.branches.map((branch) => {
    const coordinates = branch.geometry.coordinates as LonLat[];
    return coordinates.reduce((sum, point, index) => {
      if (index === 0) {
        return sum;
      }

      return sum + segmentLengthKm(coordinates[index - 1], point);
    }, 0);
  });

  const areaKm2 =
    result.polygon.geometry.type === 'Polygon'
      ? ringAreaKm2(result.polygon.geometry.coordinates[0] as LonLat[])
      : result.polygon.geometry.coordinates.reduce((sum, polygon) => {
          return sum + ringAreaKm2(polygon[0] as LonLat[]);
        }, 0);

  const totalBranchKm = branchLengths.reduce((sum, value) => sum + value, 0);
  const longestBranchKm = branchLengths.length > 0 ? Math.max(...branchLengths) : 0;

  return {
    areaKm2,
    branchCount: result.branches.length,
    sampledCount: result.meta.sampledTargetCount,
    totalBranchKm,
    longestBranchKm,
    averageBranchKm: branchLengths.length > 0 ? totalBranchKm / branchLengths.length : 0,
  };
}

export function formatDistance(valueKm: number) {
  return valueKm >= 100 ? `${Math.round(valueKm)} km` : `${valueKm.toFixed(1)} km`;
}

export function formatWalkDuration(valueKm: number) {
  const minutes = Math.max(1, Math.round((valueKm / WALKING_SPEED_KMH) * 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function getDistanceConfig(mode: TravelMode) {
  return distanceConfigs[mode];
}

export function clampDistanceForMode(valueKm: number, mode: TravelMode) {
  const config = getDistanceConfig(mode);
  const clamped = Math.min(config.max, Math.max(config.min, valueKm));
  const rounded = Math.round(clamped / config.step) * config.step;
  const decimals = config.step.toString().includes('.')
    ? config.step.toString().split('.')[1].length
    : 0;

  return Number(rounded.toFixed(decimals));
}

export function formatArea(valueKm2: number) {
  if (valueKm2 < 10) {
    return `${valueKm2.toFixed(1)} km²`;
  }

  if (valueKm2 >= 1_000) {
    return `${Math.round(valueKm2).toLocaleString()} km²`;
  }

  return `${valueKm2.toFixed(0)} km²`;
}

export function formatMode(mode: TravelMode) {
  switch (mode) {
    case 'driving':
      return 'Driving';
    case 'cycling':
      return 'Cycling';
    case 'walking':
      return 'Walking';
  }
}

export function isWalkingMode(mode: TravelMode) {
  return mode === 'walking';
}

export function buildScenarioName(location: GeocodeResult, distanceKm: number, mode: TravelMode) {
  if (mode === 'walking') {
    return `${location.name} · ${formatWalkDuration(distanceKm)} walk`;
  }

  return `${location.name} · ${distanceKm} km ${formatMode(mode).toLowerCase()}`;
}

export function buildRelativeTimestamp(isoString: string) {
  const deltaMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(isoString).getTime()) / 60_000),
  );

  if (deltaMinutes < 1) {
    return 'just now';
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ago`;
  }

  const hours = Math.round(deltaMinutes / 60);
  return `${hours}h ago`;
}

export function formatProviderLabel(provider: ReachabilityProvider) {
  return provider === 'demo' ? 'Demo mode' : 'OpenRouteService live';
}
