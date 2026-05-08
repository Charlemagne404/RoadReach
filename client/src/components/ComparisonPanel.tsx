import { ArrowRightLeft, LoaderCircle } from 'lucide-react';
import type {
  ReachabilityProvider,
  ReachabilityResponse,
  TravelMode,
} from '@roadreach/contracts';
import {
  type ReachabilityInsights,
  calculateReachabilityInsights,
  formatArea,
  formatDistance,
  formatMode,
  isWalkingMode,
  travelModes,
} from '../lib/reachability';

type ComparisonPanelProps = {
  activeMode: TravelMode;
  activeInsights: ReachabilityInsights | null;
  hasLocation: boolean;
  loadingModes: TravelMode[];
  results: Partial<Record<TravelMode, ReachabilityResponse>>;
  onActivateMode: (mode: TravelMode) => void;
};

function formatDeltaLabel(value: number, baseline: number, noun: string) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) {
    return null;
  }

  const deltaPercent = Math.round(((value - baseline) / baseline) * 100);

  if (deltaPercent === 0) {
    return `Same ${noun}`;
  }

  return `${deltaPercent > 0 ? '+' : ''}${deltaPercent}% ${noun}`;
}

function formatProviderBadge(provider: ReachabilityProvider) {
  return provider === 'demo' ? 'Demo' : 'Live';
}

export function ComparisonPanel({
  activeMode,
  activeInsights,
  hasLocation,
  loadingModes,
  results,
  onActivateMode,
}: ComparisonPanelProps) {
  if (!hasLocation) {
    return null;
  }

  const activeResult = results[activeMode] ?? null;
  const activeMetrics = activeResult
    ? calculateReachabilityInsights(activeResult)
    : activeInsights;

  return (
    <section className="comparison-panel">
      <div className="section-heading">
        <span className="section-heading__eyebrow">Compare</span>
        <h2>Same start, all modes</h2>
      </div>
      <p className="comparison-panel__intro">
        Switch overlays instantly after the first trace. Every card below keeps the same
        origin and distance.
      </p>

      <div className="comparison-grid">
        {travelModes.map((mode) => {
          const result = results[mode];
          const metrics = result ? calculateReachabilityInsights(result) : null;
          const isActive = mode === activeMode;
          const isLoading = loadingModes.includes(mode);
          const areaDelta =
            metrics && activeMetrics && !isActive
              ? formatDeltaLabel(metrics.areaKm2, activeMetrics.areaKm2, 'area')
              : null;
          const networkDelta =
            metrics && activeMetrics && !isActive
              ? formatDeltaLabel(metrics.totalBranchKm, activeMetrics.totalBranchKm, 'network')
              : null;

          return (
            <article
              key={mode}
              className={`comparison-card ${isActive ? 'is-active' : ''}`}
            >
              <div className="comparison-card__header">
                <div>
                  <span className="comparison-card__eyebrow">{formatMode(mode)}</span>
                  <strong>{isWalkingMode(mode) ? 'Pedestrian lens' : 'Comparison lens'}</strong>
                </div>
                {result ? (
                  <span className="comparison-card__badge">
                    {formatProviderBadge(result.provider)}
                  </span>
                ) : null}
              </div>

              {metrics ? (
                <>
                  <div className="comparison-card__metrics">
                    <div>
                      <span>{isWalkingMode(mode) ? 'Walkshed area' : 'Reach area'}</span>
                      <strong>{formatArea(metrics.areaKm2)}</strong>
                    </div>
                    <div>
                      <span>{isWalkingMode(mode) ? 'Network traced' : 'Network traced'}</span>
                      <strong>{formatDistance(metrics.totalBranchKm)}</strong>
                    </div>
                  </div>
                  {areaDelta || networkDelta ? (
                    <p className="comparison-card__delta">
                      {[areaDelta, networkDelta].filter(Boolean).join(' · ')}
                    </p>
                  ) : (
                    <p className="comparison-card__delta comparison-card__delta--active">
                      Current overlay
                    </p>
                  )}
                </>
              ) : isLoading ? (
                <div className="comparison-card__loading">
                  <LoaderCircle className="spin" size={16} />
                  <span>Loading comparison…</span>
                </div>
              ) : (
                <p className="comparison-card__empty">
                  {activeMetrics
                    ? 'Comparison not loaded yet.'
                    : 'Generate once to unlock side-by-side mode cards.'}
                </p>
              )}

              <button
                type="button"
                className="comparison-card__button"
                onClick={() => onActivateMode(mode)}
                disabled={!result || isActive}
              >
                <ArrowRightLeft size={15} />
                <span>{isActive ? 'Viewing' : 'View overlay'}</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
