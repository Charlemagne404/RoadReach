import { Bookmark, History, Trash2 } from 'lucide-react';
import type { GeocodeResult } from '@roadreach/contracts';
import { type SavedScenario, formatMode, formatWalkDuration } from '../lib/reachability';

type ScenarioShelfProps = {
  title: string;
  eyebrow: string;
  icon: 'saved' | 'recent';
  items: Array<SavedScenario | GeocodeResult>;
  emptyText: string;
  onSelect: (item: SavedScenario | GeocodeResult) => void;
  onRemove?: (itemId: string) => void;
};

export function ScenarioShelf({
  title,
  eyebrow,
  icon,
  items,
  emptyText,
  onSelect,
  onRemove,
}: ScenarioShelfProps) {
  const Icon = icon === 'saved' ? Bookmark : History;
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="scenario-shelf">
      <div className="section-heading">
        <span className="section-heading__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>

      {safeItems.length > 0 ? (
        <div className="scenario-list">
          {safeItems.map((item) => {
            const isSavedScenario = 'distanceKm' in item;

            return (
              <article key={item.id} className="scenario-card">
                <div className="scenario-card__header">
                  <div className="scenario-card__badge">
                    <Icon size={15} />
                  </div>
                  {onRemove && isSavedScenario ? (
                    <button
                      type="button"
                      className="scenario-card__remove"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
                <button type="button" className="scenario-card__action" onClick={() => onSelect(item)}>
                  <strong>{item.name}</strong>
                  <span className="scenario-card__detail">
                    {isSavedScenario
                      ? item.mode === 'walking'
                        ? `${formatWalkDuration(item.distanceKm)} · ${item.distanceKm.toFixed(1)} km`
                        : `${item.distanceKm} km · ${formatMode(item.mode)}`
                      : item.label}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="scenario-empty">{emptyText}</div>
      )}
    </section>
  );
}
