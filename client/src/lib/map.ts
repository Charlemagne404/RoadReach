import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { GeocodeResult, ReachabilityResponse } from '@roadreach/contracts';

export const defaultMapCenter: [number, number] = [54.526, 15.2551];
export const defaultMapZoom = 4.5;

export const startMarkerIcon = L.divIcon({
  className: 'origin-marker-wrapper',
  html: `
    <div class="origin-marker">
      <span class="origin-marker__pulse"></span>
      <span class="origin-marker__core"></span>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function getResultBounds(result: ReachabilityResponse) {
  return L.geoJSON(result.polygon as GeoJsonObject).getBounds();
}

export function formatLocationLabel(location: GeocodeResult | null) {
  if (!location) {
    return 'Pick a start point';
  }

  return location.label;
}
