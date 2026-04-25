import type { TravelMode } from '@roadreach/contracts';

const modes: Array<{ value: TravelMode; label: string; caption: string }> = [
  { value: 'driving', label: 'Drive', caption: 'fastest road reach' },
  { value: 'cycling', label: 'Cycle', caption: 'bike-friendly range' },
  { value: 'walking', label: 'Walk', caption: 'pedestrian network' },
];

type ModeSelectorProps = {
  mode: TravelMode;
  onChange: (mode: TravelMode) => void;
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-grid" role="radiogroup" aria-label="Travel mode">
      {modes.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`mode-pill ${mode === item.value ? 'is-active' : ''}`}
          aria-pressed={mode === item.value}
          onClick={() => onChange(item.value)}
        >
          <span className="mode-pill__label">{item.label}</span>
          <span className="mode-pill__caption">{item.caption}</span>
        </button>
      ))}
    </div>
  );
}
