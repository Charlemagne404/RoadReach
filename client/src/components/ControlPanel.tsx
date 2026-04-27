import {
  BookmarkPlus,
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
  TravelMode,
} from '@roadreach/contracts';
import { LocationSearch } from './LocationSearch';
import { ModeSelector } from './ModeSelector';
import { InsightsPanel } from './InsightsPanel';
import { ScenarioShelf } from './ScenarioShelf';
import {
  type ReachabilityInsights,
  type SavedScenario,
  featuredOrigins,
  formatDistance,
  formatWalkDuration,
  getDistanceConfig,
  isWalkingMode,
} from '../lib/reachability';

type ControlPanelProps = {
  searchValue: string;
  searchResults: GeocodeResult[];
  selectedLocation: GeocodeResult | null;
  recentLocations: GeocodeResult[];
  savedScenarios: SavedScenario[];
  distanceKm: number;
  mode: TravelMode;
  provider: ReachabilityProvider | null;
  generatedAt: string | null;
  insights: ReachabilityInsights | null;
  isSearching: boolean;
  isGenerating: boolean;
  isLocating: boolean;
  isStale: boolean;
  autoGenerate: boolean;
  helperText: string;
  statusMessage: string;
  errorMessage: string | null;
  shareFeedback: string | null;
  onSearchChange: (value: string) => void;
  onSearchSelect: (result: GeocodeResult) => void;
  onDistanceChange: (value: number) => void;
  onModeChange: (mode: TravelMode) => void;
  onUseMyLocation: () => void;
  onGenerate: () => void;
  onToggleAutoGenerate: () => void;
  onCopyShareLink: () => void;
  onSaveScenario: () => void;
  onReset: () => void;
  onRestoreScenario: (scenario: SavedScenario | GeocodeResult) => void;
  onRemoveScenario: (scenarioId: string) => void;
};

export function ControlPanel({
  searchValue,
  searchResults,
  selectedLocation,
  recentLocations,
  savedScenarios,
  distanceKm,
  mode,
  provider,
  generatedAt,
  insights,
  isSearching,
  isGenerating,
  isLocating,
  isStale,
  autoGenerate,
  helperText,
  statusMessage,
  errorMessage,
  shareFeedback,
  onSearchChange,
  onSearchSelect,
  onDistanceChange,
  onModeChange,
  onUseMyLocation,
  onGenerate,
  onToggleAutoGenerate,
  onCopyShareLink,
  onSaveScenario,
  onReset,
  onRestoreScenario,
  onRemoveScenario,
}: ControlPanelProps) {
  const distanceConfig = getDistanceConfig(mode);
  const walkingFocus = isWalkingMode(mode);

  return (
    <aside className="control-panel">
      <div className="control-panel__brand">
        <div className="control-panel__eyebrow">
          <Sparkles size={14} />
          <span>
            {provider === 'demo' ? 'Demo-ready reach explorer' : 'Pedestrian reach explorer'}
          </span>
        </div>
        <h1>RoadReach</h1>
        <p>
          See what is reachable from a single start, then compare that footprint across
          movement modes when needed.
        </p>
      </div>

      <div className="toolbelt-row">
        <button type="button" className="toolbelt-button" onClick={onCopyShareLink}>
          <Share2 size={16} />
          <span>{shareFeedback ?? 'Share'}</span>
        </button>
        <button
          type="button"
          className="toolbelt-button"
          onClick={onSaveScenario}
          disabled={!selectedLocation}
        >
          <BookmarkPlus size={16} />
          <span>Save</span>
        </button>
        <button type="button" className="toolbelt-button" onClick={onReset}>
          <RefreshCcw size={16} />
          <span>Reset</span>
        </button>
      </div>

      <LocationSearch
        value={searchValue}
        results={searchResults}
        isSearching={isSearching}
        helper={helperText}
        onChange={onSearchChange}
        onSelect={onSearchSelect}
      />

      <section className="field-group">
        <div className="section-heading section-heading--compact">
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

      <div className="field-group">
        <div className="field-header">
          <label className="field-label" htmlFor="distance-slider">
            {walkingFocus ? 'Walking range' : 'Range'}
          </label>
          <span className="field-value">
            {walkingFocus
              ? `${formatDistance(distanceKm)} / ${formatWalkDuration(distanceKm)}`
              : formatDistance(distanceKm)}
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
            value={distanceKm}
            onChange={(event) => onDistanceChange(Number(event.target.value))}
          />
          <input
            className="distance-number"
            type="number"
            min={distanceConfig.min}
            max={distanceConfig.max}
            step={distanceConfig.step}
            value={distanceKm}
            onChange={(event) => onDistanceChange(Number(event.target.value))}
          />
        </div>
        <div className="preset-row">
          {distanceConfig.presets.map((preset) => (
            <button
              key={`${mode}-${preset.label}`}
              type="button"
              className={`preset-pill ${distanceKm === preset.value ? 'is-active' : ''}`}
              onClick={() => onDistanceChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {walkingFocus ? (
          <p className="field-helper">Based on a one-way pace of roughly 4.8 km/h.</p>
        ) : (
          <p className="field-helper">Walking stays primary. Other modes are for comparison.</p>
        )}
      </div>

      <div className="field-group">
        <div className="section-heading section-heading--compact">
          <span className="section-heading__eyebrow">Mode</span>
          <h2>{walkingFocus ? 'Pedestrian first' : 'Comparison mode'}</h2>
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
                ? 'Refresh after changing the start, range, or comparison mode.'
                : 'Refresh after changing mode, distance, or origin.'}
            </p>
          </div>
          <span className={`toggle-switch ${autoGenerate ? 'is-active' : ''}`} />
        </button>
      </div>

      <div className="selected-location-card">
        <MapPinned size={18} />
        <div>
          <span className="selected-location-card__label">
            {walkingFocus ? 'Selected walk start' : 'Selected origin'}
          </span>
          <strong>
            {selectedLocation?.label ?? (walkingFocus ? 'No walk start selected' : 'No origin selected')}
          </strong>
          {selectedLocation ? (
            <small>
              {selectedLocation.lat.toFixed(3)}, {selectedLocation.lng.toFixed(3)}
            </small>
          ) : null}
        </div>
      </div>

      <div className="action-row">
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
                ? 'Refresh now'
                : 'Generate comparison'}
          </span>
        </button>
      </div>

      <InsightsPanel
        insights={insights}
        provider={provider}
        mode={mode}
        generatedAt={generatedAt}
      />

      <ScenarioShelf
        title={walkingFocus ? 'Saved studies' : 'Saved comparisons'}
        eyebrow="Library"
        icon="saved"
        items={savedScenarios}
        emptyText={
          walkingFocus
            ? 'Save a setup to return to it later.'
            : 'Save a setup to return to it later.'
        }
        onSelect={onRestoreScenario}
        onRemove={onRemoveScenario}
      />

      <ScenarioShelf
        title="Recent starts"
        eyebrow="History"
        icon="recent"
        items={recentLocations}
        emptyText="Pinned and searched places appear here."
        onSelect={onRestoreScenario}
      />

      <div className={`status-card ${errorMessage ? 'is-error' : isStale ? 'is-warn' : ''}`}>
        <p>{errorMessage ?? statusMessage}</p>
      </div>

      <div className="note-block">
        <p>
          {walkingFocus
            ? provider === 'demo'
              ? 'Demo mode keeps the flow interactive without setup. Add an OpenRouteService key for live network results.'
              : provider === 'openrouteservice'
                ? 'OpenRouteService powers the live trace. The envelope shows the walkshed while the lines sample the street and path network.'
                : 'Pick a start point to generate a walkshed and inspect the sampled pedestrian network.'
            : 'RoadReach is built around walking first, with cycling and driving available as comparison layers.'}
        </p>
      </div>
    </aside>
  );
}
