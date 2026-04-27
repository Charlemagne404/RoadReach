import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import type {
  GeocodeResult,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';
import { ControlPanel } from './components/ControlPanel';
import { MapView } from './components/MapView';
import { fetchReachability, reverseGeocode, searchLocations } from './api/client';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import {
  type MapTheme,
  type SavedScenario,
  buildScenarioName,
  calculateReachabilityInsights,
  clampDistanceForMode,
  getDistanceConfig,
  isWalkingMode,
} from './lib/reachability';
import { applyPageSeo } from './lib/seo';

type UrlState = {
  lat?: number;
  lng?: number;
  label?: string;
  distanceKm?: number;
  mode?: TravelMode;
};

const defaultStatusMessage = 'Choose a start point to trace what opens up around it.';
const defaultMode: TravelMode = 'walking';
const defaultDistanceKm = 2.4;

function parseUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const latParam = params.get('lat');
  const lngParam = params.get('lng');
  const distanceParam = params.get('distance');
  const lat = latParam === null ? Number.NaN : Number(latParam);
  const lng = lngParam === null ? Number.NaN : Number(lngParam);
  const distanceKm = distanceParam === null ? Number.NaN : Number(distanceParam);
  const mode = params.get('mode');
  const label = params.get('label') ?? undefined;

  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0.5 ? distanceKm : undefined,
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

  const queryString = params.toString();
  const nextUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;
  window.history.replaceState(null, '', nextUrl);
}

function buildSignature(location: GeocodeResult | null, distanceKm: number, mode: TravelMode) {
  if (!location) {
    return '';
  }

  return `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}:${distanceKm}:${mode}`;
}

function mergeRecentLocations(
  current: GeocodeResult[],
  location: GeocodeResult,
  limit = 6,
) {
  return [location, ...current.filter((item) => item.id !== location.id)].slice(0, limit);
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
  const [distanceKm, setDistanceKm] = useState(initialUrlState.distanceKm ?? defaultDistanceKm);
  const [mode, setMode] = useState<TravelMode>(initialUrlState.mode ?? defaultMode);
  const [mapTheme, setMapTheme] = useLocalStorageState<MapTheme>('roadreach:map-theme', 'atlas');
  const [autoGenerate, setAutoGenerate] = useLocalStorageState('roadreach:auto-generate', true);
  const [savedScenarios, setSavedScenarios] = useLocalStorageState<SavedScenario[]>(
    'roadreach:saved-scenarios',
    [],
  );
  const [recentLocations, setRecentLocations] = useLocalStorageState<GeocodeResult[]>(
    'roadreach:recent-locations',
    [],
  );
  const [reachability, setReachability] = useState<ReachabilityResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [lastGeneratedSignature, setLastGeneratedSignature] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);

  const deferredSearchValue = useDeferredValue(searchValue);
  const debouncedSearchValue = useDebouncedValue(deferredSearchValue.trim(), 260);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    updateUrlState(selectedLocation, distanceKm, mode);
  }, [selectedLocation, distanceKm, mode]);

  useEffect(() => {
    if (!shareFeedback) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShareFeedback(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

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
    const clampedDistance = clampDistanceForMode(distanceKm, mode);

    if (clampedDistance !== distanceKm) {
      setDistanceKm(clampedDistance);
    }
  }, [distanceKm, mode]);

  const currentSignature = buildSignature(selectedLocation, distanceKm, mode);
  const isStale = Boolean(reachability) && currentSignature !== lastGeneratedSignature;
  const insights = reachability ? calculateReachabilityInsights(reachability) : null;
  const safeMapTheme: MapTheme =
    mapTheme === 'night' || mapTheme === 'atlas' || mapTheme === 'light'
      ? mapTheme
      : 'atlas';
  const safeSavedScenarios = Array.isArray(savedScenarios) ? savedScenarios : [];
  const safeRecentLocations = Array.isArray(recentLocations) ? recentLocations : [];

  useEffect(() => {
    applyPageSeo({
      distanceKm,
      insights,
      location: selectedLocation,
      mode,
    });
  }, [distanceKm, insights, mode, selectedLocation]);

  function handleSelectLocation(location: GeocodeResult) {
    setSelectedLocation(location);
    setSearchValue(location.label);
    setSearchResults([]);
    setRecentLocations((current) => mergeRecentLocations(current, location));
    setStatusMessage(
      isWalkingMode(mode)
        ? 'Start pinned. Adjust the walking range or trace the walkshed now.'
        : 'Start pinned. Compare how that area opens up across travel modes.',
    );
    setErrorMessage(null);
  }

  async function resolveLocation(lat: number, lng: number) {
    const response = await reverseGeocode(lat, lng);

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
    setStatusMessage('Resolving the dropped pin into a walk start…');

    try {
      const location = await resolveLocation(lat, lng);
      handleSelectLocation(location);
    } catch (error) {
      const location = {
        id: `${lat}:${lng}`,
        name: 'Dropped pin',
        label: `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
      };
      handleSelectLocation(location);
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
    setStatusMessage('Reading browser geolocation for your walking start…');

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

  const runGeneration = useEffectEvent(async () => {
    if (!selectedLocation) {
      setErrorMessage(isWalkingMode(mode) ? 'Choose a walk start first.' : 'Choose a starting location first.');
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(
      isWalkingMode(mode)
        ? 'Tracing pedestrian reach from the selected start…'
        : 'Tracing network reach from the selected start…',
    );

    try {
      const response = await fetchReachability(
        selectedLocation.lat,
        selectedLocation.lng,
        distanceKm,
        mode,
        { signal: controller.signal },
      );

      startTransition(() => {
        setReachability(response);
        setLastGeneratedSignature(currentSignature);
      });

      setStatusMessage(
        isWalkingMode(mode)
          ? response.provider === 'demo'
            ? `Mapped ${response.meta.successfulBranchCount} demo walk corridors across the sampled walkshed.`
            : `Mapped ${response.meta.successfulBranchCount} sampled pedestrian corridors across the walkshed.`
          : response.provider === 'demo'
            ? `Generated ${response.meta.successfulBranchCount} demo corridors across the sampled reach envelope.`
            : `Generated ${response.meta.successfulBranchCount} sampled network branches across the reachable envelope.`,
      );
      setFocusRequest((current) => current + 1);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Reachability failed.');
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsGenerating(false);
      }
    }
  });

  useEffect(() => {
    if (!autoGenerate || !selectedLocation) {
      return;
    }

    if (currentSignature === lastGeneratedSignature && reachability) {
      return;
    }

    void runGeneration();
  }, [
    autoGenerate,
    currentSignature,
    lastGeneratedSignature,
    reachability,
    runGeneration,
    selectedLocation,
  ]);

  function handleDistanceChange(value: number) {
    const fallback = getDistanceConfig(mode).min;
    const nextValue = Number.isFinite(value) ? clampDistanceForMode(value, mode) : fallback;
    setDistanceKm(nextValue);
  }

  function handleToggleAutoGenerate() {
    setAutoGenerate((current) => !current);
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareFeedback('Link copied');
    } catch {
      setShareFeedback('Copy failed');
    }
  }

  function handleSaveScenario() {
    if (!selectedLocation) {
      return;
    }

    const scenario: SavedScenario = {
      id: `${selectedLocation.id}:${distanceKm}:${mode}`,
      name: buildScenarioName(selectedLocation, distanceKm, mode),
      location: selectedLocation,
      distanceKm,
      mode,
      createdAt: new Date().toISOString(),
    };

    setSavedScenarios((current) => {
      const deduped = current.filter((item) => item.id !== scenario.id);
      return [scenario, ...deduped].slice(0, 8);
    });
    setStatusMessage(
      isWalkingMode(mode)
        ? 'Walk scenario saved locally for quick recall.'
        : 'Scenario saved locally for quick recall.',
    );
  }

  function handleRestoreScenario(item: SavedScenario | GeocodeResult) {
    if ('distanceKm' in item) {
      setDistanceKm(item.distanceKm);
      setMode(item.mode);
      handleSelectLocation(item.location);
      setStatusMessage(
        item.mode === 'walking' ? 'Saved walk restored.' : 'Saved scenario restored.',
      );
      return;
    }

    handleSelectLocation(item);
    setStatusMessage('Start restored from your recent history.');
  }

  function handleRemoveScenario(scenarioId: string) {
    setSavedScenarios((current) => current.filter((item) => item.id !== scenarioId));
  }

  function handleReset() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setSelectedLocation(null);
    setSearchValue('');
    setSearchResults([]);
    setDistanceKm(defaultDistanceKm);
    setMode(defaultMode);
    setReachability(null);
    setLastGeneratedSignature('');
    setErrorMessage(null);
    setStatusMessage(defaultStatusMessage);
  }

  return (
    <main className="app-shell">
      <MapView
        origin={selectedLocation}
        result={reachability}
        provider={reachability?.provider ?? null}
        insights={insights}
        mode={mode}
        theme={safeMapTheme}
        focusRequest={focusRequest}
        isLoading={isGenerating}
        isLocating={isLocating}
        onMapPick={(lat, lng) => void handleMapPick(lat, lng)}
        onThemeChange={setMapTheme}
        onRecenter={() => setFocusRequest((current) => current + 1)}
      />

      <div className="chrome-gradient chrome-gradient--top" />
      <div className="chrome-gradient chrome-gradient--bottom" />

      <ControlPanel
        searchValue={searchValue}
        searchResults={searchResults}
        selectedLocation={selectedLocation}
        recentLocations={safeRecentLocations}
        savedScenarios={safeSavedScenarios}
        distanceKm={distanceKm}
        mode={mode}
        provider={reachability?.provider ?? null}
        generatedAt={reachability?.meta.generatedAt ?? null}
        insights={insights}
        isSearching={isSearching}
        isGenerating={isGenerating}
        isLocating={isLocating}
        isStale={isStale}
        autoGenerate={autoGenerate}
        helperText="Search a place, click the map, or start from a featured origin."
        statusMessage={
          isStale && !autoGenerate
            ? isWalkingMode(mode)
              ? 'Inputs changed after the last render. Generate again to refresh the walkshed.'
              : 'Inputs changed after the last render. Generate again to refresh the network.'
            : statusMessage
        }
        errorMessage={errorMessage}
        shareFeedback={shareFeedback}
        onSearchChange={setSearchValue}
        onSearchSelect={handleSelectLocation}
        onDistanceChange={handleDistanceChange}
        onModeChange={setMode}
        onUseMyLocation={handleUseMyLocation}
        onGenerate={() => void runGeneration()}
        onToggleAutoGenerate={handleToggleAutoGenerate}
        onCopyShareLink={() => void handleCopyShareLink()}
        onSaveScenario={handleSaveScenario}
        onReset={handleReset}
        onRestoreScenario={handleRestoreScenario}
        onRemoveScenario={handleRemoveScenario}
      />
    </main>
  );
}
