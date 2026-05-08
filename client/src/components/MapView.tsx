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
import type {
  GeocodeResult,
  ReachabilityProvider,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';
import { MapToolbar } from './MapToolbar';
import {
  type MapTheme,
  type ReachabilityInsights,
  formatArea,
  formatDistance,
  isWalkingMode,
} from '../lib/reachability';
import {
  defaultMapCenter,
  defaultMapZoom,
  getResultBounds,
  startMarkerIcon,
} from '../lib/map';

type MapViewProps = {
  origin: GeocodeResult | null;
  result: ReachabilityResponse | null;
  provider: ReachabilityProvider | null;
  insights: ReachabilityInsights | null;
  mode: TravelMode;
  theme: MapTheme;
  focusRequest: number;
  isLoading: boolean;
  isLocating: boolean;
  isMapPickArmed: boolean;
  onMapPick: (lat: number, lng: number) => void;
  onThemeChange: (theme: MapTheme) => void;
  onRecenter: () => void;
};

const basemaps: Record<
  MapTheme,
  {
    url: string;
    attribution: string;
  }
> = {
  night: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  atlas: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};

function MapEffects({
  origin,
  result,
  focusRequest,
}: Pick<MapViewProps, 'origin' | 'result' | 'focusRequest'>) {
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

  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }

    if (result) {
      map.fitBounds(getResultBounds(result), {
        padding: [64, 64],
        maxZoom: 13,
      });
      return;
    }

    if (origin) {
      map.flyTo([origin.lat, origin.lng], Math.max(map.getZoom(), 11), {
        animate: true,
        duration: 1,
      });
    }
  }, [focusRequest, map, origin, result]);

  return null;
}

function MapClickHandler({
  isMapPickArmed,
  onMapPick,
}: Pick<MapViewProps, 'isMapPickArmed' | 'onMapPick'>) {
  useMapEvents({
    click(event) {
      if (!isMapPickArmed) {
        return;
      }

      onMapPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function MapView({
  origin,
  result,
  provider,
  insights,
  mode,
  theme,
  focusRequest,
  isLoading,
  isLocating,
  isMapPickArmed,
  onMapPick,
  onThemeChange,
  onRecenter,
}: MapViewProps) {
  const branchCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: result?.branches ?? [],
  };
  const activeBasemap = basemaps[theme] ?? basemaps.night;
  const walkingFocus = isWalkingMode(mode);
  const resultKey = result?.meta.generatedAt ?? 'empty';

  return (
    <div className={`map-shell ${isMapPickArmed ? 'is-map-pick-armed' : ''}`}>
      <MapContainer
        className={`map-canvas ${isMapPickArmed ? 'map-canvas--armed' : ''}`}
        center={defaultMapCenter}
        zoom={defaultMapZoom}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url={activeBasemap.url} attribution={activeBasemap.attribution} />

        <Pane name="reach-polygon" style={{ zIndex: 420 }} />
        <Pane name="reach-branch-glow" style={{ zIndex: 430 }} />
        <Pane name="reach-branch-core" style={{ zIndex: 440 }} />
        <Pane name="origin" style={{ zIndex: 460 }} />

        <MapEffects origin={origin} result={result} focusRequest={focusRequest} />
        <MapClickHandler isMapPickArmed={isMapPickArmed} onMapPick={onMapPick} />

        {result ? (
          <GeoJSON
            key={`polygon-${resultKey}`}
            data={result.polygon as GeoJsonObject}
            pane="reach-polygon"
            style={() => ({
              color: '#61ebd7',
              weight: 1.6,
              opacity: 0.58,
              fillColor: theme === 'light' ? '#127db2' : '#45b4ff',
              fillOpacity: theme === 'light' ? 0.16 : 0.12,
              className: 'reach-envelope',
            })}
          />
        ) : null}

        {result?.branches.length ? (
          <>
            <GeoJSON
              key={`branches-glow-${resultKey}`}
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-glow"
              style={() => ({
                color: '#53f2ff',
                weight: 12,
                opacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'reach-branch reach-branch--glow',
              })}
            />
            <GeoJSON
              key={`branches-mid-${resultKey}`}
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-core"
              style={() => ({
                color: '#78ffd3',
                weight: 5,
                opacity: 0.5,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'reach-branch reach-branch--mid',
              })}
            />
            <GeoJSON
              key={`branches-core-${resultKey}`}
              data={branchCollection as GeoJsonObject}
              pane="reach-branch-core"
              style={() => ({
                color: '#f6fff8',
                weight: 2.4,
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

      <MapToolbar
        mode={mode}
        theme={theme}
        onThemeChange={onThemeChange}
        onRecenter={onRecenter}
        hasResult={Boolean(result)}
      />

      {!origin && !isMapPickArmed ? (
        <div className="map-overlay-card">
          <h2>{walkingFocus ? 'Pick a start' : 'Pick an origin'}</h2>
          <p>
            {walkingFocus
              ? 'Search a place, use your location, or arm map picking from the panel to trace what opens up on foot.'
              : 'Choose a shared origin first, then switch the active mode to compare outward reach.'}
          </p>
        </div>
      ) : null}

      {insights ? (
        <div className="map-summary-card">
          <div className="map-summary-card__header">
            <span>
              {walkingFocus
                ? provider === 'demo'
                  ? 'Demo walkshed'
                  : 'Live walkshed'
                : provider === 'demo'
                  ? 'Demo estimate'
                  : 'Live result'}
            </span>
            <strong>{formatArea(insights.areaKm2)}</strong>
          </div>
          <div className="map-summary-card__metrics">
            <div>
              <span>{walkingFocus ? 'Paths' : 'Branches'}</span>
              <strong>{insights.branchCount}</strong>
            </div>
            <div>
              <span>{walkingFocus ? 'Longest walk' : 'Longest route'}</span>
              <strong>{formatDistance(insights.longestBranchKm)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {isMapPickArmed ? (
        <div className="map-status-pill map-status-pill--armed">
          Click once on the map to place the start point.
        </div>
      ) : isLocating ? (
        <div className="map-status-pill">Resolving location…</div>
      ) : isLoading ? (
        <div className="map-status-pill">
          {walkingFocus ? 'Tracing walkshed…' : 'Tracing reachability…'}
        </div>
      ) : null}
    </div>
  );
}
