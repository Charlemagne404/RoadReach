import { useRef } from 'react';
import type { TravelMode } from '@roadreach/contracts';
import { travelModes } from '../lib/reachability';

const modeMeta: Record<TravelMode, { label: string; caption: string }> = {
  walking: { label: 'Walk', caption: 'primary lens' },
  cycling: { label: 'Cycle', caption: 'bike reach' },
  driving: { label: 'Drive', caption: 'car reach' },
};

type ModeSelectorProps = {
  mode: TravelMode;
  onChange: (mode: TravelMode) => void;
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="mode-grid" role="radiogroup" aria-label="Travel mode">
      {travelModes.map((travelMode, index) => {
        const item = modeMeta[travelMode];
        const isActive = mode === travelMode;

        return (
          <button
            key={travelMode}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            className={`mode-pill ${isActive ? 'is-active' : ''}`}
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(travelMode)}
            onKeyDown={(event) => {
              const isForward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
              const isBackward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';

              if (!isForward && !isBackward) {
                return;
              }

              event.preventDefault();
              const nextIndex = isForward
                ? (index + 1) % travelModes.length
                : (index - 1 + travelModes.length) % travelModes.length;
              const nextMode = travelModes[nextIndex];
              buttonRefs.current[nextIndex]?.focus();
              onChange(nextMode);
            }}
          >
            <span className="mode-pill__label">{item.label}</span>
            <span className="mode-pill__caption">{item.caption}</span>
          </button>
        );
      })}
    </div>
  );
}
