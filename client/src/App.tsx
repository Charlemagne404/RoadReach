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
  type SiteTheme,
  buildScenarioName,
  calculateReachabilityInsights,
  clampDistanceForMode,
  getDistanceConfig,
  isWalkingMode,
} from './lib/reachability';
import { applyPageSeo } from './lib/seo';

type UrlState = {
  distanceKm?: number;
  label?: string;
  lat?: number;
  lng?: number;
  mode?: TravelMode;
};

type ComparisonState = {
  errors: Partial<Record<TravelMode, string>>;
  loadingModes: TravelMode[];
  results: Partial<Record<TravelMode, ReachabilityResponse>>;
  signature: string;
};

type SelectionOptions = {
  distanceKm?: number;
  mode?: TravelMode;
  statusMessage?: string;
};

const defaultStatusMessage = 'Choose a start point to trace what opens up around it.';
const defaultMode: TravelMode = 'walking';
const defaultDistanceKm = 2.4;
const defaultAutoGenerate = false;
const defaultSiteTheme: SiteTheme = 'dark';
const emptyComparisonState: ComparisonState = {
  errors: {},
  loadingModes: [],
  results: {},
  signature: '',
};

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

function buildComparisonSignature(location: GeocodeResult | null, distanceKm: number) {
  if (!location) {
    return '';
  }

  return `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}:${distanceKm}`;
}

function mergeRecentLocations(
  current: GeocodeResult[],
  location: GeocodeResult,
  limit = 6,
) {
  return [location, ...current.filter((item) => item.id !== location.id)].slice(0, limit);
}

const initialUrlState = parseUrlState();
const initialDistanceKm = initialUrlState.distanceKm ?? defaultDistanceKm;

function buildGenerationStatus(response: ReachabilityResponse) {
  if (response.meta.branchStrategy === 'none') {
    return `Generated a live reach envelope without branch requests.`;
  }

  if (response.meta.branchStrategy === 'sampled-routes') {
    return `Generated ${response.meta.successfulBranchCount} sampled network routes.`;
  }

  return `Generated ${response.meta.successfulBranchCount} local reach corridors from one live envelope.`;
}

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
  const [distanceKm, setDistanceKm] = useState(initialDistanceKm);
  const [distanceDraftKm, setDistanceDraftKm] = useState(initialDistanceKm);
  const [mode, setMode] = useState<TravelMode>(initialUrlState.mode ?? defaultMode);
  const [mapTheme, setMapTheme] = useLocalStorageState<MapTheme>('roadreach:map-theme', 'night');
  const [siteTheme, setSiteTheme] = useLocalStorageState<SiteTheme>(
    'roadreach:site-theme',
    defaultSiteTheme,
  );
  const [autoGenerate, setAutoGenerate] = useLocalStorageState(
    'roadreach:auto-generate',
    defaultAutoGenerate,
  );
  const [savedScenarios, setSavedScenarios] = useLocalStorageState<SavedScenario[]>(
    'roadreach:saved-scenarios',
    [],
  );
  const [recentLocations, setRecentLocations] = useLocalStorageState<GeocodeResult[]>(
    'roadreach:recent-locations',
    [],
  );
  const [reachability, setReachability] = useState<ReachabilityResponse | null>(null);
  const [comparisonState, setComparisonState] = useState<ComparisonState>(emptyComparisonState);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMapPickArmed, setIsMapPickArmed] = useState(false);
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

  const currentSignature = buildSignature(selectedLocation, distanceKm, mode);
  const comparisonSignature = buildComparisonSignature(selectedLocation, distanceKm);
  const isStale = Boolean(reachability) && currentSignature !== lastGeneratedSignature;
  const insights = reachability ? calculateReachabilityInsights(reachability) : null;
  const safeMapTheme: MapTheme =
    mapTheme === 'night' || mapTheme === 'atlas' || mapTheme === 'light'
      ? mapTheme
      : 'night';
  const safeSiteTheme: SiteTheme = siteTheme === 'light' ? 'light' : 'dark';
  const safeSavedScenarios = Array.isArray(savedScenarios) ? savedScenarios : [];
  const safeRecentLocations = Array.isArray(recentLocations) ? recentLocations : [];
  const currentComparisonResults =
    comparisonState.signature === comparisonSignature ? comparisonState.results : {};
  const currentComparisonLoadingModes =
    comparisonState.signature === comparisonSignature ? comparisonState.loadingModes : [];

  useEffect(() => {
    applyPageSeo({
      distanceKm,
      insights,
      location: selectedLocation,
      mode,
    });
  }, [distanceKm, insights, mode, selectedLocation]);

  function clearReachabilityPreview() {
    setReachability(null);
    setLastGeneratedSignature('');
  }

  function abortActiveGeneration() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setIsGenerating(false);
  }

  function resetComparisonState() {
    setComparisonState(emptyComparisonState);
  }

  function storeComparisonResult(signature: string, response: ReachabilityResponse) {
    setComparisonState((current) => {
      const base =
        current.signature === signature
          ? current
          : {
              ...emptyComparisonState,
              signature,
            };
      const nextErrors = { ...base.errors };
      delete nextErrors[response.mode];

      return {
        signature,
        results: {
          ...base.results,
          [response.mode]: response,
        },
        loadingModes: base.loadingModes.filter((item) => item !== response.mode),
        errors: nextErrors,
      };
    });
  }

  function handleSelectLocation(location: GeocodeResult, options?: SelectionOptions) {
    const nextMode = options?.mode ?? mode;
    const nextDistanceKm = options?.distanceKm ?? distanceKm;

    abortActiveGeneration();
    clearReachabilityPreview();
    resetComparisonState();
    setSelectedLocation(location);
    setSearchValue(location.label);
    setSearchResults([]);
    setDistanceKm(nextDistanceKm);
    setDistanceDraftKm(nextDistanceKm);
    setMode(nextMode);
    setRecentLocations((current) => mergeRecentLocations(current, location));
    setIsMapPickArmed(false);
    setFocusRequest((current) => current + 1);
    setStatusMessage(
      options?.statusMessage ??
        (isWalkingMode(nextMode)
          ? 'Start pinned. Release the distance slider or trace the walkshed now.'
          : 'Start pinned. Generate when you are ready to compare the same range.'),
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
    setStatusMessage('Resolving the map pick into a start point…');

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

    setIsMapPickArmed(false);
    setIsLocating(true);
    setErrorMessage(null);
    setStatusMessage('Reading browser geolocation for your start point…');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = await resolveLocation(
            position.coords.latitude,
            position.coords.longitude,
          );
          handleSelectLocation(location);
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not resolve your location.',
          );
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

  const runGeneration = useEffectEvent(
    async (override?: { distanceKm?: number; mode?: TravelMode }) => {
      if (!selectedLocation) {
        setErrorMessage(
          isWalkingMode(mode) ? 'Choose a walk start first.' : 'Choose a starting location first.',
        );
        return;
      }

      const activeMode = override?.mode ?? mode;
      const activeDistanceKm = override?.distanceKm ?? distanceKm;
      const activeSignature = buildSignature(selectedLocation, activeDistanceKm, activeMode);
      const activeComparisonSignature = buildComparisonSignature(selectedLocation, activeDistanceKm);

      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      setIsGenerating(true);
      setErrorMessage(null);
      setStatusMessage(
        isWalkingMode(activeMode)
          ? 'Tracing pedestrian reach from the selected start…'
          : 'Tracing network reach from the selected start…',
      );

      try {
        const response = await fetchReachability(
          selectedLocation.lat,
          selectedLocation.lng,
          activeDistanceKm,
          activeMode,
          { signal: controller.signal },
        );

        startTransition(() => {
          setReachability(response);
          setLastGeneratedSignature(activeSignature);
          storeComparisonResult(activeComparisonSignature, response);
        });

        setStatusMessage(buildGenerationStatus(response));
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
    },
  );

  useEffect(() => {
    if (!autoGenerate || !selectedLocation || isGenerating) {
      return;
    }

    if (currentSignature === lastGeneratedSignature && reachability) {
      return;
    }

    void runGeneration();
  }, [
    autoGenerate,
    currentSignature,
    isGenerating,
    lastGeneratedSignature,
    reachability,
    runGeneration,
    selectedLocation,
  ]);

  function handleDistanceDraftChange(value: number) {
    if (!Number.isFinite(value)) {
      return;
    }

    setDistanceDraftKm(value);
  }

  function handleDistanceCommit(nextValue = distanceDraftKm) {
    const fallback = getDistanceConfig(mode).min;
    const committedValue = Number.isFinite(nextValue)
      ? clampDistanceForMode(nextValue, mode)
      : fallback;

    setDistanceDraftKm(committedValue);

    if (committedValue === distanceKm) {
      return;
    }

    abortActiveGeneration();
    clearReachabilityPreview();
    resetComparisonState();
    setDistanceKm(committedValue);
    setErrorMessage(null);
    setStatusMessage(
      isWalkingMode(mode)
        ? 'Distance updated. Release confirmed and ready to trace again.'
        : 'Distance updated. Generate again to refresh the matched comparison range.',
    );
  }

  function handleModeChange(nextMode: TravelMode) {
    const nextDistanceKm = clampDistanceForMode(distanceKm, nextMode);
    const nextDistanceDraftKm = clampDistanceForMode(distanceDraftKm, nextMode);
    const nextComparisonSignature = buildComparisonSignature(selectedLocation, nextDistanceKm);
    const cachedResult =
      selectedLocation && comparisonState.signature === nextComparisonSignature
        ? comparisonState.results[nextMode] ?? null
        : null;

    setMode(nextMode);
    setDistanceKm(nextDistanceKm);
    setDistanceDraftKm(nextDistanceDraftKm);
    setErrorMessage(null);
    abortActiveGeneration();

    if (!selectedLocation) {
      clearReachabilityPreview();
      setStatusMessage(
        isWalkingMode(nextMode)
          ? 'Walking stays primary. Pick a start to begin.'
          : 'Pick a start first, then compare the same distance across modes.',
      );
      return;
    }

    if (comparisonState.signature !== nextComparisonSignature) {
      resetComparisonState();
    }

    if (cachedResult) {
      setReachability(cachedResult);
      setLastGeneratedSignature(buildSignature(selectedLocation, nextDistanceKm, nextMode));
      setStatusMessage(
        isWalkingMode(nextMode)
          ? 'Walking overlay loaded from the comparison cache.'
          : `${nextMode === 'cycling' ? 'Cycling' : 'Driving'} overlay loaded from the comparison cache.`,
      );
      return;
    }

    clearReachabilityPreview();
    setStatusMessage(
      isWalkingMode(nextMode)
        ? 'Walking selected. Generate to refresh the matched comparison range.'
        : `${nextMode === 'cycling' ? 'Cycling' : 'Driving'} selected. Generate to compare the same range.`,
    );
  }

  function handleToggleAutoGenerate() {
    setAutoGenerate((current) => !current);
  }

  function handleToggleMapPick() {
    setIsMapPickArmed((current) => {
      const nextValue = !current;
      setErrorMessage(null);
      setStatusMessage(
        nextValue
          ? 'Map picking armed. Click once on the map to place the start.'
          : selectedLocation
            ? 'Map picking cancelled. Your selected start is still active.'
            : defaultStatusMessage,
      );
      return nextValue;
    });
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
      handleSelectLocation(item.location, {
        distanceKm: item.distanceKm,
        mode: item.mode,
        statusMessage:
          item.mode === 'walking'
            ? 'Saved walk restored. Generate once if you want fresh live data.'
            : 'Saved comparison restored. Generate once if you want fresh live data.',
      });
      return;
    }

    handleSelectLocation(item, {
      statusMessage: 'Start restored from your recent history.',
    });
  }

  function handleRemoveScenario(scenarioId: string) {
    setSavedScenarios((current) => current.filter((item) => item.id !== scenarioId));
  }

  function handleReset() {
    abortActiveGeneration();
    setSelectedLocation(null);
    setSearchValue('');
    setSearchResults([]);
    setDistanceKm(defaultDistanceKm);
    setDistanceDraftKm(defaultDistanceKm);
    setMode(defaultMode);
    setIsMapPickArmed(false);
    clearReachabilityPreview();
    resetComparisonState();
    setErrorMessage(null);
    setStatusMessage(defaultStatusMessage);
  }

  return (
    <main className={`app-shell app-shell--${safeSiteTheme}`}>
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
        isMapPickArmed={isMapPickArmed}
        onMapPick={(lat, lng) => void handleMapPick(lat, lng)}
        onThemeChange={setMapTheme}
        onRecenter={() => setFocusRequest((current) => current + 1)}
      />

      <div className="chrome-gradient chrome-gradient--top" />
      <div className="chrome-gradient chrome-gradient--bottom" />

      <ControlPanel
        autoGenerate={autoGenerate}
        comparisonLoadingModes={currentComparisonLoadingModes}
        comparisonResults={currentComparisonResults}
        distanceDraftKm={distanceDraftKm}
        errorMessage={errorMessage}
        generatedAt={reachability?.meta.generatedAt ?? null}
        helperText="Search an address or city, use your location, or arm map picking from the map."
        insights={insights}
        isGenerating={isGenerating}
        isLocating={isLocating}
        isMapPickArmed={isMapPickArmed}
        isSearching={isSearching}
        isStale={isStale}
        mode={mode}
        provider={reachability?.provider ?? null}
        recentLocations={safeRecentLocations}
        savedScenarios={safeSavedScenarios}
        searchResults={searchResults}
        searchValue={searchValue}
        selectedLocation={selectedLocation}
        shareFeedback={shareFeedback}
        siteTheme={safeSiteTheme}
        statusMessage={
          isStale && !autoGenerate
            ? isWalkingMode(mode)
              ? 'Inputs changed after the last render. Release the distance or generate again to refresh the walkshed.'
              : 'Inputs changed after the last render. Generate again to refresh the matched comparison range.'
            : statusMessage
        }
        onActivateComparisonMode={handleModeChange}
        onCopyShareLink={() => void handleCopyShareLink()}
        onDistanceCommit={handleDistanceCommit}
        onDistanceDraftChange={handleDistanceDraftChange}
        onGenerate={() => void runGeneration()}
        onModeChange={handleModeChange}
        onRemoveScenario={handleRemoveScenario}
        onReset={handleReset}
        onRestoreScenario={handleRestoreScenario}
        onSaveScenario={handleSaveScenario}
        onSearchChange={setSearchValue}
        onSearchSelect={handleSelectLocation}
        onToggleAutoGenerate={handleToggleAutoGenerate}
        onToggleMapPick={handleToggleMapPick}
        onToggleSiteTheme={() =>
          setSiteTheme((current) => (current === 'light' ? 'dark' : 'light'))
        }
        onUseMyLocation={handleUseMyLocation}
      />
    </main>
  );
}
