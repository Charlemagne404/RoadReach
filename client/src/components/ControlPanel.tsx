import {
  LoaderCircle,
  LocateFixed,
  MapPinned,
  Route,
  Sparkles,
} from 'lucide-react';
import type { GeocodeResult, TravelMode } from '@roadreach/contracts';
import { LocationSearch } from './LocationSearch';
import { ModeSelector } from './ModeSelector';

type ControlPanelProps = {
  searchValue: string;
  searchResults: GeocodeResult[];
  selectedLocation: GeocodeResult | null;
  distanceKm: number;
  mode: TravelMode;
  isSearching: boolean;
  isGenerating: boolean;
  isLocating: boolean;
  isStale: boolean;
  helperText: string;
  statusMessage: string;
  errorMessage: string | null;
  onSearchChange: (value: string) => void;
  onSearchSelect: (result: GeocodeResult) => void;
  onDistanceChange: (value: number) => void;
  onModeChange: (mode: TravelMode) => void;
  onUseMyLocation: () => void;
  onGenerate: () => void;
};

const presets = [5, 15, 40, 80];

export function ControlPanel({
  searchValue,
  searchResults,
  selectedLocation,
  distanceKm,
  mode,
  isSearching,
  isGenerating,
  isLocating,
  isStale,
  helperText,
  statusMessage,
  errorMessage,
  onSearchChange,
  onSearchSelect,
  onDistanceChange,
  onModeChange,
  onUseMyLocation,
  onGenerate,
}: ControlPanelProps) {
  return (
    <aside className="control-panel">
      <div className="control-panel__brand">
        <div className="control-panel__eyebrow">
          <Sparkles size={14} />
          <span>Road-network reachability</span>
        </div>
        <h1>RoadReach</h1>
        <p>
          See how far a trip can stretch along real roads, then render the frontier as
          branching route tendrils instead of a plain radius.
        </p>
      </div>

      <LocationSearch
        value={searchValue}
        results={searchResults}
        isSearching={isSearching}
        helper={helperText}
        onChange={onSearchChange}
        onSelect={onSearchSelect}
      />

      <div className="field-group">
        <div className="field-header">
          <label className="field-label" htmlFor="distance-slider">
            Travel distance
          </label>
          <span className="field-value">{distanceKm} km</span>
        </div>
        <div className="distance-input-row">
          <input
            id="distance-slider"
            className="distance-slider"
            type="range"
            min={1}
            max={250}
            step={1}
            value={distanceKm}
            onChange={(event) => onDistanceChange(Number(event.target.value))}
          />
          <input
            className="distance-number"
            type="number"
            min={1}
            max={250}
            step={1}
            value={distanceKm}
            onChange={(event) => onDistanceChange(Number(event.target.value))}
          />
        </div>
        <div className="preset-row">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`preset-pill ${distanceKm === preset ? 'is-active' : ''}`}
              onClick={() => onDistanceChange(preset)}
            >
              {preset} km
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Travel mode</label>
        <ModeSelector mode={mode} onChange={onModeChange} />
      </div>

      <div className="selected-location-card">
        <MapPinned size={18} />
        <div>
          <span className="selected-location-card__label">Current origin</span>
          <strong>{selectedLocation?.label ?? 'No location selected yet'}</strong>
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
          <span>Generate reachability</span>
        </button>
      </div>

      <div className={`status-card ${errorMessage ? 'is-error' : isStale ? 'is-warn' : ''}`}>
        <p>{errorMessage ?? statusMessage}</p>
      </div>

      <div className="note-block">
        <p>
          Based on GraphHopper road-network isodistance. The filled region shows the
          reachable envelope, while the bright branch lines are sampled real routes to the
          frontier.
        </p>
      </div>
    </aside>
  );
}
