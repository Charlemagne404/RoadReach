import { useState } from 'react';
import { ChevronDown, ChevronUp, Focus, Layers3 } from 'lucide-react';
import type { TravelMode } from '@roadreach/contracts';
import { type MapTheme, isWalkingMode, mapThemes } from '../lib/reachability';

type MapToolbarProps = {
  hasResult: boolean;
  mode: TravelMode;
  onRecenter: () => void;
  onThemeChange: (theme: MapTheme) => void;
  theme: MapTheme;
};

export function MapToolbar({
  hasResult,
  mode,
  onRecenter,
  onThemeChange,
  theme,
}: MapToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const walkingFocus = isWalkingMode(mode);

  return (
    <div className={`map-toolbar ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="map-toolbar__bar">
        <div className="map-toolbar__label">
          <Layers3 size={14} />
          <span>Map tools</span>
        </div>
        <button
          type="button"
          className="map-toolbar__toggle"
          aria-expanded={isExpanded}
          aria-controls="map-toolbar-content"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      <div id="map-toolbar-content" className="map-toolbar__content">
        <div className="map-toolbar__group">
          <div className="map-toolbar__label">
            <Layers3 size={14} />
            <span>Map theme</span>
          </div>
          <div className="map-toolbar__themes">
            {mapThemes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`map-toolbar__theme ${theme === item.id ? 'is-active' : ''}`}
                onClick={() => onThemeChange(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.caption}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="map-toolbar__group">
          <div className="map-toolbar__label">
            <Layers3 size={14} />
            <span>Legend</span>
          </div>
          <div className="map-toolbar__legend">
            <div className="legend-row">
              <span className="legend-swatch legend-swatch--fill" />
              <span>{walkingFocus ? 'Walkshed' : 'Reach area'}</span>
            </div>
            <div className="legend-row">
              <span className="legend-swatch legend-swatch--branch" />
              <span>{walkingFocus ? 'Reach corridors' : 'Reach branches'}</span>
            </div>
            <div className="legend-row">
              <span className="legend-swatch legend-swatch--origin" />
              <span>{walkingFocus ? 'Start point' : 'Origin point'}</span>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="map-toolbar__recenter" onClick={onRecenter}>
        <Focus size={15} />
        <span>{hasResult ? 'Refocus result' : 'Focus origin'}</span>
      </button>
    </div>
  );
}
