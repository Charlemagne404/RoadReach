import type {
  GeocodeResult,
  ReachabilityBranchFeature,
  ReachabilityPolygonFeature,
  TravelMode,
} from '@roadreach/contracts';

type DemoLocation = GeocodeResult & {
  searchTerms: string[];
};

type LonLat = [number, number];

const demoLocations: DemoLocation[] = [
  {
    id: 'stockholm-se',
    name: 'Stockholm',
    label: 'Stockholm, Sweden',
    lat: 59.3293,
    lng: 18.0686,
    country: 'Sweden',
    region: 'Stockholm County',
    locality: 'Stockholm',
    searchTerms: ['stockholm', 'sweden', 'sverige'],
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
    searchTerms: ['copenhagen', 'kobenhavn', 'denmark'],
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
    searchTerms: ['berlin', 'germany', 'deutschland'],
  },
  {
    id: 'london-uk',
    name: 'London',
    label: 'London, United Kingdom',
    lat: 51.5072,
    lng: -0.1276,
    country: 'United Kingdom',
    region: 'England',
    locality: 'London',
    searchTerms: ['london', 'england', 'uk', 'united kingdom'],
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
    searchTerms: ['barcelona', 'spain', 'espana'],
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
    searchTerms: ['new york', 'nyc', 'manhattan', 'usa', 'united states'],
  },
  {
    id: 'cape-town-za',
    name: 'Cape Town',
    label: 'Cape Town, South Africa',
    lat: -33.9249,
    lng: 18.4241,
    country: 'South Africa',
    region: 'Western Cape',
    locality: 'Cape Town',
    searchTerms: ['cape town', 'south africa'],
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
    searchTerms: ['tokyo', 'japan'],
  },
];

const modeConfig: Record<
  TravelMode,
  {
    branchCount: number;
    branchWeight: number;
    biasScale: number;
    radialJitter: number;
    twist: number;
  }
> = {
  driving: {
    branchCount: 16,
    branchWeight: 1.12,
    biasScale: 0.23,
    radialJitter: 0.16,
    twist: 0.42,
  },
  cycling: {
    branchCount: 13,
    branchWeight: 0.94,
    biasScale: 0.15,
    radialJitter: 0.12,
    twist: 0.28,
  },
  walking: {
    branchCount: 10,
    branchWeight: 0.78,
    biasScale: 0.08,
    radialJitter: 0.08,
    twist: 0.18,
  },
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function distanceKmBetween(a: LonLat, b: LonLat) {
  const lat1 = degreesToRadians(a[1]);
  const lat2 = degreesToRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = degreesToRadians(b[0] - a[0]);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * 6371 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function offsetCoordinate(lat: number, lng: number, distanceKm: number, bearingRadians: number): LonLat {
  const angularDistance = distanceKm / 6371;
  const startLat = degreesToRadians(lat);
  const startLng = degreesToRadians(lng);

  const nextLat = Math.asin(
    Math.sin(startLat) * Math.cos(angularDistance) +
      Math.cos(startLat) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );

  const nextLng =
    startLng +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(startLat),
      Math.cos(angularDistance) - Math.sin(startLat) * Math.sin(nextLat),
    );

  return [radiansToDegrees(nextLng), radiansToDegrees(nextLat)];
}

function scoreLocation(location: DemoLocation, query: string) {
  const text = normalize(query);

  if (!text) {
    return 0;
  }

  if (location.searchTerms.some((term) => term === text)) {
    return 5;
  }

  if (location.searchTerms.some((term) => term.startsWith(text))) {
    return 4;
  }

  if (location.searchTerms.some((term) => term.includes(text))) {
    return 3;
  }

  if (location.label.toLowerCase().includes(text)) {
    return 2;
  }

  return 0;
}

function createBranch(
  origin: { lat: number; lng: number },
  distanceKm: number,
  baseAngle: number,
  mode: TravelMode,
  index: number,
) {
  const config = modeConfig[mode];
  const points: LonLat[] = [[origin.lng, origin.lat]];
  const segments = 4 + (index % 3);

  for (let step = 1; step <= segments; step += 1) {
    const progress = step / segments;
    const twist =
      Math.sin(baseAngle * 2.4 + index * 0.7 + progress * Math.PI) * config.twist * (1 - progress);
    const shoulder =
      Math.cos(baseAngle * 1.4 - index * 0.35 + progress * Math.PI * 1.8) *
      config.radialJitter *
      progress;
    const angle = baseAngle + twist;
    const branchDistanceKm =
      distanceKm *
      config.branchWeight *
      progress *
      (0.72 + shoulder + Math.sin(index + progress * 2.7) * 0.03);

    points.push(offsetCoordinate(origin.lat, origin.lng, branchDistanceKm, angle));
  }

  const feature: ReachabilityBranchFeature = {
    type: 'Feature',
    properties: {
      source: 'demo',
      branchIndex: index,
    },
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
  };

  return feature;
}

export function searchDemoLocations(query: string) {
  return [...demoLocations]
    .map((location) => ({
      location,
      score: scoreLocation(location, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.location.name.localeCompare(right.location.name))
    .slice(0, 6)
    .map(({ location }) => {
      const { searchTerms: _searchTerms, ...result } = location;
      return result;
    });
}

export function reverseDemoLocation(lat: number, lng: number) {
  const closest = [...demoLocations]
    .map((location) => ({
      location,
      distanceKm: distanceKmBetween([lng, lat], [location.lng, location.lat]),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];

  if (!closest || closest.distanceKm > 120) {
    return null;
  }

  const { searchTerms: _searchTerms, ...result } = closest.location;
  return result;
}

export function buildDemoReachability(
  lat: number,
  lng: number,
  distanceKm: number,
  mode: TravelMode,
) {
  const config = modeConfig[mode];
  const steps = 48;
  const ring: LonLat[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = progress * Math.PI * 2;
    const waveA = Math.sin(angle * 2.3 + degreesToRadians(lat) * 3.2) * 0.1;
    const waveB = Math.cos(angle * 4.8 - degreesToRadians(lng) * 2.4) * 0.06;
    const corridorBias = Math.max(0, Math.cos(angle - 0.65)) * config.biasScale;
    const southernBias = Math.max(0, Math.sin(angle + 1.1)) * (config.biasScale * 0.55);
    const radiusKm =
      distanceKm * (0.72 + waveA + waveB + corridorBias + southernBias);

    ring.push(offsetCoordinate(lat, lng, Math.max(distanceKm * 0.45, radiusKm), angle));
  }

  const polygon: ReachabilityPolygonFeature = {
    type: 'Feature',
    properties: {
      source: 'demo',
      mode,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };

  const branches = Array.from({ length: config.branchCount }, (_, index) => {
    const angle =
      (index / config.branchCount) * Math.PI * 2 +
      Math.sin(index * 1.7 + degreesToRadians(lat)) * 0.12;

    return createBranch({ lat, lng }, distanceKm, angle, mode, index);
  });

  return {
    polygon,
    branches,
  };
}

export function getDemoLocations() {
  return demoLocations.map(({ searchTerms: _searchTerms, ...location }) => location);
}
