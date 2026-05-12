import type { TravelMode } from '@roadreach/contracts';

type LegendProps = {
  mode: TravelMode;
};

export function Legend({ mode }: LegendProps) {
  const walkingFocus = mode === 'walking';

  return (
    <div className="legend-card">
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
  );
}
