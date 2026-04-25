import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import type {
  GeocodeResult,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';
import { ControlPanel } from './components/ControlPanel';
import { MapView } from './components/MapView';
import { fetchReachability, reverseGeocode, searchLocations } from './api/client';
import { useDebouncedValue } from './hooks/useDebouncedValue';

type UrlState = {
  lat?: number;
  lng?: number;
  label?: string;
  distanceKm?: number;
  mode?: TravelMode;
};

function parseUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const distanceKm = Number(params.get('distance'));
  const mode = params.get('mode');
  const label = params.get('label') ?? undefined;

  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    distanceKm: Number.isFinite(distanceKm) && distanceKm >= 1 ? distanceKm : undefined,
    mode:
      mode === 'driving' || mode === 'cycling' || mode === 'walking'
        ? mode
        : undefined,
    label,
  };
}

function updateUrlState(location: GeocodeResult | null, distanceKm: number, mode: TravelMode) {
  const params = new URLSearchParams(window.location.search);

  if (location) {
    params.set('lat', location.lat.toFixed(6));
    params.set('lng', location.lng.toFixed(6));
    params.set('label', location.label);
  } else {
    params.delete('lat');
    params.delete('lng');
    params.delete('label');
  }

  params.set('distance', String(distanceKm));
  params.set('mode', mode);

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', nextUrl);
}

function buildSignature(location: GeocodeResult | null, distanceKm: number, mode: TravelMode) {
  if (!location) {
    return '';
  }

  return `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}:${distanceKm}:${mode}`;
}

const initialUrlState = parseUrlState();

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<GeocodeResult | null>(
    initialUrlState.lat !== undefined && initialUrlState.lng !== undefined
      ? {
          id: 'url-origin',
          name: initialUrlState.label ?? 'Shared location',
          label: initialUrlState.label ?? 'Shared location',
          lat: initialUrlState.lat,
          lng: initialUrlState.lng,
        }
      : null,
  );
  const [searchValue, setSearchValue] = useState(initialUrlState.label ?? '');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [distanceKm, setDistanceKm] = useState(initialUrlState.distanceKm ?? 25);
  const [mode, setMode] = useState<TravelMode>(initialUrlState.mode ?? 'driving');
  const [reachability, setReachability] = useState<ReachabilityResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Choose a point and trace how the road network fans out from it.',
  );
  const [lastGeneratedSignature, setLastGeneratedSignature] = useState('');

  const deferredSearchValue = useDeferredValue(searchValue);
  const debouncedSearchValue = useDebouncedValue(deferredSearchValue.trim(), 260);
  const initialAutoRunRef = useRef(false);

  useEffect(() => {
    updateUrlState(selectedLocation, distanceKm, mode);
  }, [selectedLocation, distanceKm, mode]);

  useEffect(() => {
    if (debouncedSearchValue.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (
      selectedLocation &&
      debouncedSearchValue.toLowerCase() === selectedLocation.label.toLowerCase()
    ) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    searchLocations(debouncedSearchValue, { signal: controller.signal })
      .then((response) => {
        setSearchResults(response.results);
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => controller.abort();
  }, [debouncedSearchValue, selectedLocation]);

  useEffect(() => {
    if (initialAutoRunRef.current || !selectedLocation) {
      return;
    }

    if (initialUrlState.lat === undefined || initialUrlState.lng === undefined) {
      initialAutoRunRef.current = true;
      return;
    }

    initialAutoRunRef.current = true;
    void handleGenerate();
  }, [selectedLocation]);

  const currentSignature = buildSignature(selectedLocation, distanceKm, mode);
  const isStale = Boolean(reachability) && currentSignature !== lastGeneratedSignature;

  function handleSelectLocation(location: GeocodeResult) {
    setSelectedLocation(location);
    setSearchValue(location.label);
    setSearchResults([]);
    setStatusMessage('Location pinned. Generate reachability to trace the network.');
    setErrorMessage(null);
  }

  async function resolveLocation(lat: number, lng: number) {
    const controller = new AbortController();
    const response = await reverseGeocode(lat, lng, { signal: controller.signal });

    return (
      response.location ?? {
        id: `${lat}:${lng}`,
        name: 'Pinned location',
        label: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
      }
    );
  }

  async function handleMapPick(lat: number, lng: number) {
    setIsLocating(true);
    setErrorMessage(null);
    setStatusMessage('Snapping the picked point to a recognizable place…');

    try {
      const location = await resolveLocation(lat, lng);
      handleSelectLocation(location);
    } catch (error) {
      setSelectedLocation({
        id: `${lat}:${lng}`,
        name: 'Dropped pin',
        label: `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
      });
      setSearchValue(`Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      setErrorMessage(error instanceof Error ? error.message : 'Could not resolve that point.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setErrorMessage('Browser geolocation is not available on this device.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);
    setStatusMessage('Reading browser geolocation…');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = await resolveLocation(
            position.coords.latitude,
            position.coords.longitude,
          );
          handleSelectLocation(location);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not resolve your location.');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        setErrorMessage(error.message || 'Could not access your current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
      },
    );
  }

  async function handleGenerate() {
    if (!selectedLocation) {
      setErrorMessage('Choose a starting location first.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage('Computing road-based reachability from the selected origin…');

    try {
      const response = await fetchReachability(
        selectedLocation.lat,
        selectedLocation.lng,
        distanceKm,
        mode,
      );

      startTransition(() => {
        setReachability(response);
        setLastGeneratedSignature(currentSignature);
      });

      setStatusMessage(
        `Generated ${response.meta.successfulBranchCount} sampled road branches across the reachable envelope.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Reachability failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell">
      <MapView
        origin={selectedLocation}
        result={reachability}
        isLoading={isGenerating}
        isLocating={isLocating}
        onMapPick={(lat, lng) => void handleMapPick(lat, lng)}
      />

      <div className="chrome-gradient chrome-gradient--top" />
      <div className="chrome-gradient chrome-gradient--bottom" />

      <ControlPanel
        searchValue={searchValue}
        searchResults={searchResults}
        selectedLocation={selectedLocation}
        distanceKm={distanceKm}
        mode={mode}
        isSearching={isSearching}
        isGenerating={isGenerating}
        isLocating={isLocating}
        isStale={isStale}
        helperText="Search a place, click directly on the map, or use browser geolocation."
        statusMessage={
          isStale
            ? 'Inputs changed after the last render. Generate again to refresh the branch network.'
            : statusMessage
        }
        errorMessage={errorMessage}
        onSearchChange={setSearchValue}
        onSearchSelect={handleSelectLocation}
        onDistanceChange={(value) => {
          const nextValue = Number.isFinite(value) ? Math.max(1, Math.min(250, value)) : 1;
          setDistanceKm(nextValue);
        }}
        onModeChange={setMode}
        onUseMyLocation={handleUseMyLocation}
        onGenerate={() => void handleGenerate()}
      />
    </main>
  );
}
