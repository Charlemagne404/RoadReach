import type {
  ReachabilityBranchFeature,
  ReachabilityPolygonFeature,
} from '@roadreach/contracts';

type LonLat = [number, number];

const EARTH_RADIUS_METERS = 6_371_000;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isSamePoint(a: LonLat, b: LonLat) {
  return a[0] === b[0] && a[1] === b[1];
}

function closeRing(ring: LonLat[]) {
  if (ring.length === 0) {
    return ring;
  }

  return isSamePoint(ring[0], ring[ring.length - 1])
    ? ring
    : [...ring, ring[0]];
}

function segmentLengthMeters(a: LonLat, b: LonLat) {
  const lat1 = degreesToRadians(a[1]);
  const lat2 = degreesToRadians(b[1]);
  const deltaLng = degreesToRadians(b[0] - a[0]) * Math.cos((lat1 + lat2) / 2);
  const deltaLat = degreesToRadians(b[1] - a[1]);

  return Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat) * EARTH_RADIUS_METERS;
}

function ringAreaEstimate(ring: LonLat[]) {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

function getOuterRing(feature: ReachabilityPolygonFeature) {
  if (feature.geometry.type === 'Polygon') {
    return closeRing(feature.geometry.coordinates[0] as LonLat[]);
  }

  const polygons = feature.geometry.coordinates;
  const sorted = [...polygons].sort((left, right) => {
    const leftArea = ringAreaEstimate(left[0] as LonLat[]);
    const rightArea = ringAreaEstimate(right[0] as LonLat[]);
    return rightArea - leftArea;
  });

  return closeRing(sorted[0][0] as LonLat[]);
}

function interpolate(a: LonLat, b: LonLat, factor: number): LonLat {
  return [
    a[0] + (b[0] - a[0]) * factor,
    a[1] + (b[1] - a[1]) * factor,
  ];
}

function sampleRingPoints(ring: LonLat[], count: number) {
  if (ring.length < 2 || count <= 0) {
    return [] as LonLat[];
  }

  const lengths: number[] = [];
  let totalLength = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    totalLength += segmentLengthMeters(ring[index], ring[index + 1]);
    lengths.push(totalLength);
  }

  if (totalLength === 0) {
    return [];
  }

  const step = totalLength / count;
  const samples: LonLat[] = [];

  for (let index = 0; index < count; index += 1) {
    const target = index * step + step / 2;
    let segmentIndex = lengths.findIndex((value) => value >= target);

    if (segmentIndex === -1) {
      segmentIndex = lengths.length - 1;
    }

    const segmentStartDistance = segmentIndex === 0 ? 0 : lengths[segmentIndex - 1];
    const segmentLength = lengths[segmentIndex] - segmentStartDistance;
    const ratio = segmentLength === 0 ? 0 : (target - segmentStartDistance) / segmentLength;

    samples.push(interpolate(ring[segmentIndex], ring[segmentIndex + 1], ratio));
  }

  return samples;
}

function distanceBetweenPointsMeters(a: LonLat, b: LonLat) {
  return segmentLengthMeters(a, b);
}

function dedupeTargets(points: LonLat[], minimumSpacingMeters: number) {
  return points.filter((point, index) =>
    points.findIndex(
      (candidate) =>
        distanceBetweenPointsMeters(point, candidate) <= minimumSpacingMeters,
    ) === index,
  );
}

function hashLineCoordinates(coordinates: LonLat[]) {
  return coordinates
    .map(([lng, lat]) => `${lng.toFixed(5)}:${lat.toFixed(5)}`)
    .join('|');
}

export function buildBranchTargets(
  origin: LonLat,
  polygon: ReachabilityPolygonFeature,
  distanceKm: number,
) {
  const ring = getOuterRing(polygon);
  const outerCount = Math.max(4, Math.min(6, Math.round(distanceKm / 40) + 4));
  const outerTargets = sampleRingPoints(ring, outerCount);
  const innerTargets = outerTargets
    .filter((_, index) => index % 3 === 0)
    .map((target) => interpolate(origin, target, 0.68));

  return dedupeTargets(
    [...outerTargets, ...innerTargets],
    Math.max(500, (distanceKm * 1000) / 10),
  );
}

export function dedupeBranchFeatures(features: ReachabilityBranchFeature[]) {
  const seen = new Set<string>();

  return features.filter((feature) => {
    const key = hashLineCoordinates(feature.geometry.coordinates as LonLat[]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
