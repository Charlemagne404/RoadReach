import { Focus, Layers3 } from 'lucide-react';
import { type MapTheme, mapThemes } from '../lib/reachability';

type MapToolbarProps = {
  theme: MapTheme;
  onThemeChange: (theme: MapTheme) => void;
  onRecenter: () => void;
  hasResult: boolean;
};

export function MapToolbar({
  theme,
  onThemeChange,
  onRecenter,
  hasResult,
}: MapToolbarProps) {
  return (
    <div className="map-toolbar">
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

      <button type="button" className="map-toolbar__recenter" onClick={onRecenter}>
        <Focus size={15} />
        <span>{hasResult ? 'Refocus' : 'Focus origin'}</span>
      </button>
    </div>
  );
}
