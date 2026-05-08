import {
  BookmarkPlus,
  Crosshair,
  LoaderCircle,
  LocateFixed,
  MapPinned,
  RefreshCcw,
  Route,
  Share2,
  Sparkles,
} from 'lucide-react';
import type {
  GeocodeResult,
  ReachabilityProvider,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';
import continentalWordmark from '../assets/made-by-continental-black.png';
import { LocationSearch } from './LocationSearch';
import { ModeSelector } from './ModeSelector';
import { InsightsPanel } from './InsightsPanel';
import { ScenarioShelf } from './ScenarioShelf';
import { ComparisonPanel } from './ComparisonPanel';
import {
  type ReachabilityInsights,
  type SavedScenario,
  featuredOrigins,
  formatDistance,
  formatWalkDuration,
  getDistanceConfig,
  isWalkingMode,
} from '../lib/reachability';
import {
  CONTINENTAL_CONTACT_URL,
  CONTINENTAL_GITHUB_URL,
  CONTINENTAL_PATREON_URL,
} from '../lib/siteLinks';

type ControlPanelProps = {
  autoGenerate: boolean;
  comparisonLoadingModes: TravelMode[];
  comparisonResults: Partial<Record<TravelMode, ReachabilityResponse>>;
  distanceDraftKm: number;
  errorMessage: string | null;
  generatedAt: string | null;
  helperText: string;
  insights: ReachabilityInsights | null;
  isGenerating: boolean;
  isLocating: boolean;
  isMapPickArmed: boolean;
  isSearching: boolean;
  isStale: boolean;
  mode: TravelMode;
  provider: ReachabilityProvider | null;
  recentLocations: GeocodeResult[];
  savedScenarios: SavedScenario[];
  searchResults: GeocodeResult[];
  searchValue: string;
  selectedLocation: GeocodeResult | null;
  shareFeedback: string | null;
  statusMessage: string;
  onActivateComparisonMode: (mode: TravelMode) => void;
  onCopyShareLink: () => void;
  onDistanceCommit: (value?: number) => void;
  onDistanceDraftChange: (value: number) => void;
  onGenerate: () => void;
  onModeChange: (mode: TravelMode) => void;
  onRemoveScenario: (scenarioId: string) => void;
  onReset: () => void;
  onRestoreScenario: (scenario: SavedScenario | GeocodeResult) => void;
  onSaveScenario: () => void;
  onSearchChange: (value: string) => void;
  onSearchSelect: (result: GeocodeResult) => void;
  onToggleAutoGenerate: () => void;
  onToggleMapPick: () => void;
  onUseMyLocation: () => void;
};

export function ControlPanel({
  autoGenerate,
  comparisonLoadingModes,
  comparisonResults,
  distanceDraftKm,
  errorMessage,
  generatedAt,
  helperText,
  insights,
  isGenerating,
  isLocating,
  isMapPickArmed,
  isSearching,
  isStale,
  mode,
  provider,
  recentLocations,
  savedScenarios,
  searchResults,
  searchValue,
  selectedLocation,
  shareFeedback,
  statusMessage,
  onActivateComparisonMode,
  onCopyShareLink,
  onDistanceCommit,
  onDistanceDraftChange,
  onGenerate,
  onModeChange,
  onRemoveScenario,
  onReset,
  onRestoreScenario,
  onSaveScenario,
  onSearchChange,
  onSearchSelect,
  onToggleAutoGenerate,
  onToggleMapPick,
  onUseMyLocation,
}: ControlPanelProps) {
  const distanceConfig = getDistanceConfig(mode);
  const hasResult = Boolean(insights);
  const walkingFocus = isWalkingMode(mode);

  return (
    <aside className="control-panel" aria-label="RoadReach controls">
      <div className="control-panel__brand">
        <div className="control-panel__eyebrow">
          <Sparkles size={14} />
          <span>
            {provider === 'demo' ? 'Demo-ready reach explorer' : 'Pedestrian reach explorer'}
          </span>
        </div>
        <h1>RoadReach</h1>
        <p>
          Pick one start, lock a distance, then compare what that same footprint
          unlocks across movement modes.
        </p>
      </div>

      <section className="field-group">
        <div className="section-heading section-heading--compact">
          <span className="section-heading__eyebrow">Step 1</span>
          <h2>Pick a start point</h2>
        </div>

        <LocationSearch
          value={searchValue}
          results={searchResults}
          isSearching={isSearching}
          helper={helperText}
          selectedLabel={selectedLocation?.label ?? null}
          onChange={onSearchChange}
          onSelect={onSearchSelect}
        />

        <div className="action-row action-row--start">
          <button
            type="button"
            className="secondary-button"
            onClick={onUseMyLocation}
            disabled={isLocating}
          >
            {isLocating ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={18} />}
            <span>Use my location</span>
          </button>
          <button
            type="button"
            className={`secondary-button ${isMapPickArmed ? 'is-active' : ''}`}
            onClick={onToggleMapPick}
            aria-pressed={isMapPickArmed}
          >
            <Crosshair size={18} />
            <span>{isMapPickArmed ? 'Cancel map pick' : 'Pick on map'}</span>
          </button>
        </div>

        <div className={`selected-location-card ${selectedLocation ? '' : 'is-empty'}`}>
          <MapPinned size={18} />
          <div>
            <span className="selected-location-card__label">
              {walkingFocus ? 'Selected walk start' : 'Selected origin'}
            </span>
            <strong>
              {selectedLocation?.label ??
                (isMapPickArmed
                  ? 'Map picking is armed. Click once on the map to place the start.'
                  : walkingFocus
                    ? 'No walk start selected yet'
                    : 'No origin selected yet')}
            </strong>
            {selectedLocation ? (
              <small>
                {selectedLocation.lat.toFixed(3)}, {selectedLocation.lng.toFixed(3)}
              </small>
            ) : null}
          </div>
        </div>

        <div className="section-heading section-heading--compact section-heading--nested">
          <span className="section-heading__eyebrow">Quick Start</span>
          <h2>Featured origins</h2>
        </div>
        <div className="chip-grid">
          {featuredOrigins.map((location) => (
            <button
              key={location.id}
              type="button"
              className="launch-chip"
              onClick={() => onSearchSelect(location)}
            >
              <strong>{location.name}</strong>
              <span>{location.country}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="field-group">
        <div className="section-heading section-heading--compact">
          <span className="section-heading__eyebrow">Step 2</span>
          <h2>Set the distance</h2>
        </div>

        <div className="field-header">
          <label className="field-label" htmlFor="distance-slider">
            {walkingFocus ? 'Walking range' : 'Shared comparison range'}
          </label>
          <span className="field-value">
            {walkingFocus
              ? `${formatDistance(distanceDraftKm)} / ${formatWalkDuration(distanceDraftKm)}`
              : formatDistance(distanceDraftKm)}
          </span>
        </div>

        <div className="distance-input-row">
          <input
            id="distance-slider"
            className="distance-slider"
            type="range"
            min={distanceConfig.min}
            max={distanceConfig.max}
            step={distanceConfig.step}
            value={distanceDraftKm}
            onChange={(event) => onDistanceDraftChange(Number(event.target.value))}
            onPointerUp={() => onDistanceCommit()}
            onKeyUp={() => onDistanceCommit()}
          />
          <input
            className="distance-number"
            type="number"
            min={distanceConfig.min}
            max={distanceConfig.max}
            step={distanceConfig.step}
            value={distanceDraftKm}
            onChange={(event) => onDistanceDraftChange(Number(event.target.value))}
            onBlur={() => onDistanceCommit()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onDistanceCommit();
              }
            }}
          />
        </div>

        <div className="preset-row">
          {distanceConfig.presets.map((preset) => (
            <button
              key={`${mode}-${preset.label}`}
              type="button"
              className={`preset-pill ${distanceDraftKm === preset.value ? 'is-active' : ''}`}
              onClick={() => onDistanceCommit(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <p className="field-helper">
          {walkingFocus
            ? 'Drag freely, then release to commit a walkshed distance.'
            : 'Keep the same committed distance across modes so the comparison cards stay fair.'}
        </p>
      </section>

      <section className="field-group">
        <div className="section-heading section-heading--compact">
          <span className="section-heading__eyebrow">Step 3</span>
          <h2>Choose the active mode</h2>
        </div>

        <ModeSelector mode={mode} onChange={onModeChange} />

        <button
          type="button"
          className={`toggle-card ${autoGenerate ? 'is-active' : ''}`}
          onClick={onToggleAutoGenerate}
        >
          <div>
            <strong>Auto-refresh</strong>
            <p>
              {walkingFocus
                ? 'Refresh after changing the start, released distance, or comparison mode.'
                : 'Refresh after changing mode, released distance, or origin.'}
            </p>
          </div>
          <span className={`toggle-switch ${autoGenerate ? 'is-active' : ''}`} />
        </button>

        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onReset}>
            <RefreshCcw size={18} />
            <span>Clear setup</span>
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onGenerate}
            disabled={!selectedLocation || isGenerating}
          >
            {isGenerating ? <LoaderCircle className="spin" size={18} /> : <Route size={18} />}
            <span>
              {walkingFocus
                ? autoGenerate
                  ? 'Refresh walkshed'
                  : 'Trace walkshed'
                : autoGenerate
                  ? 'Refresh comparison'
                  : 'Generate comparison'}
            </span>
          </button>
        </div>
      </section>

      <div className={`status-card ${errorMessage ? 'is-error' : isStale ? 'is-warn' : ''}`}>
        <p>{errorMessage ?? statusMessage}</p>
      </div>

      <InsightsPanel
        insights={insights}
        provider={provider}
        mode={mode}
        generatedAt={generatedAt}
      />

      <ComparisonPanel
        activeMode={mode}
        activeInsights={insights}
        hasLocation={Boolean(selectedLocation)}
        loadingModes={comparisonLoadingModes}
        results={comparisonResults}
        onActivateMode={onActivateComparisonMode}
      />

      {hasResult ? (
        <div className="toolbelt-row toolbelt-row--result">
          <button type="button" className="toolbelt-button" onClick={onCopyShareLink}>
            <Share2 size={16} />
            <span>{shareFeedback ?? 'Share result'}</span>
          </button>
          <button type="button" className="toolbelt-button" onClick={onSaveScenario}>
            <BookmarkPlus size={16} />
            <span>Save scenario</span>
          </button>
        </div>
      ) : null}

      <ScenarioShelf
        title={walkingFocus ? 'Saved studies' : 'Saved comparisons'}
        eyebrow="Library"
        icon="saved"
        items={savedScenarios}
        emptyText="Save a setup after a result appears so you can jump back into it later."
        onSelect={onRestoreScenario}
        onRemove={onRemoveScenario}
      />

      <ScenarioShelf
        title="Recent starts"
        eyebrow="History"
        icon="recent"
        items={recentLocations}
        emptyText="Pinned and searched places appear here after you use the explorer."
        onSelect={onRestoreScenario}
      />

      <div className="note-block">
        <p>
          {walkingFocus
            ? provider === 'demo'
              ? 'Demo mode keeps the flow interactive without setup. Add an OpenRouteService key for live network results and auto-filled comparison cards.'
              : 'The envelope shows the full walkshed while the highlighted branches sample the path and street network inside it.'
            : 'RoadReach stays distance-matched across modes so walking, cycling, and driving overlays are easier to compare honestly.'}
        </p>
      </div>

      <footer className="site-footer" aria-label="RoadReach footer">
        <div className="site-footer__mark" aria-label="Made by Continental">
          <span>Made by</span>
          <img src={continentalWordmark} alt="Continental" />
        </div>
        <nav className="site-footer__links" aria-label="Site links">
          <a href={CONTINENTAL_GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={CONTINENTAL_PATREON_URL} target="_blank" rel="noreferrer">
            Patreon
          </a>
          <a href={CONTINENTAL_CONTACT_URL} target="_blank" rel="noreferrer">
            Contact
          </a>
          <a href="/privacy-policy.html">Privacy</a>
          <a href="/terms-of-service.html">Terms</a>
        </nav>
      </footer>
    </aside>
  );
}
