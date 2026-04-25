import { useEffect } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import type { FeatureCollection, GeoJsonObject } from 'geojson';
import type { GeocodeResult, ReachabilityResponse } from '@roadreach/contracts';
import { Legend } from './Legend';
import {
  defaultMapCenter,
  defaultMapZoom,
  getResultBounds,
  startMarkerIcon,
} from '../lib/map';

type MapViewProps = {
  origin: GeocodeResult | null;
  result: ReachabilityResponse | null;
  isLoading: boolean;
  isLocating: boolean;
  onMapPick: (lat: number, lng: number) => void;
};

function MapEffects({ origin, result }: Pick<MapViewProps, 'origin' | 'result'>) {
  const map = useMap();

  useEffect(() => {
    if (result) {
      map.fitBounds(getResultBounds(result), {
        padding: [48, 48],
        maxZoom: 13,
      });
      return;
    }

    if (origin) {
      map.flyTo([origin.lat, origin.lng], 11, {
        animate: true,
        duration: 1.1,
      });
    }
  }, [map, origin, result]);

  return null;
}

function MapClickHandler({ onMapPick }: Pick<MapViewProps, 'onMapPick'>) {
  useMapEvents({
    click(event) {
      onMapPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function MapView({ origin, result, isLoading, isLocating, onMapPick }: MapViewProps) {
  const branchCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: result?.branches ?? [],
  };

  return (
    <div className="map-shell">
      <MapContainer
        className="map-canvas"
        center={defaultMapCenter}
        zoom={defaultMapZoom}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />

        <Pane name="reach-polygon" style={{ zIndex: 420 }} />
        <Pane name="reach-branch-glow" style={{ zIndex: 430 }} />
        <Pane name="reach-branch-core" style={{ zIndex: 440 }} />
        <Pane name="origin" style={{ zIndex: 460 }} />

        <MapEffects origin={origin} result={result} />
        <MapClickHandler onMapPick={onMapPick} />

        {result ? (
          <GeoJSON
            data={result.polygon as GeoJsonObject}
            pane="reach-polygon"
            style={() => ({
              color: '#5deed7',
              weight: 1.5,
              opacity: 0.6,
              fillColor: '#45b4ff',
              fillOpacity: 0.12,
              className: 'reach-envelope',
            })}
          />
        ) : null}

        {result?.branches.length ? (
          <>
            <GeoJSON
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-glow"
              style={() => ({
                color: '#53f2ff',
                weight: 10,
                opacity: 0.09,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'reach-branch reach-branch--glow',
              })}
            />
            <GeoJSON
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-core"
              style={() => ({
                color: '#78ffd3',
                weight: 4,
                opacity: 0.32,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'reach-branch reach-branch--mid',
              })}
            />
            <GeoJSON
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-core"
              style={() => ({
                color: '#f6fff8',
                weight: 1.7,
                opacity: 0.94,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'reach-branch reach-branch--core',
              })}
            />
          </>
        ) : null}

        {origin ? (
          <>
            <Marker
              position={[origin.lat, origin.lng]}
              icon={startMarkerIcon}
              pane="origin"
            />
            <CircleMarker
              center={[origin.lat, origin.lng]}
              pane="origin"
              radius={18}
              pathOptions={{
                color: '#8fffe6',
                opacity: 0.3,
                fillColor: '#8fffe6',
                fillOpacity: 0.03,
              }}
            />
          </>
        ) : null}
      </MapContainer>

      <div className="map-gradient" />
      <Legend />

      {!origin ? (
        <div className="map-overlay-card">
          <h2>Set a launch point</h2>
          <p>Search, click the map, or use browser geolocation to anchor the road network.</p>
        </div>
      ) : null}

      {isLocating ? (
        <div className="map-status-pill">Resolving location…</div>
      ) : isLoading ? (
        <div className="map-status-pill">Tracing road reach…</div>
      ) : null}
    </div>
  );
}
