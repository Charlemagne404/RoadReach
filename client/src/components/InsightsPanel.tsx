import { Activity, Compass, Network, Orbit } from 'lucide-react';
import type { ReachabilityProvider, TravelMode } from '@roadreach/contracts';
import {
  type ReachabilityInsights,
  buildRelativeTimestamp,
  formatArea,
  formatDistance,
  formatMode,
  formatProviderLabel,
  isWalkingMode,
} from '../lib/reachability';

type InsightsPanelProps = {
  insights: ReachabilityInsights | null;
  provider: ReachabilityProvider | null;
  mode: TravelMode;
  generatedAt: string | null;
};

export function InsightsPanel({
  insights,
  provider,
  mode,
  generatedAt,
}: InsightsPanelProps) {
  const walkingFocus = isWalkingMode(mode);
  const insightItems = [
    {
      key: 'area',
      label: walkingFocus ? 'Walkshed area' : 'Reach area',
      icon: Orbit,
      accessor: (value: ReachabilityInsights) => formatArea(value.areaKm2),
    },
    {
      key: 'total',
      label: walkingFocus ? 'Walk network' : 'Network traced',
      icon: Network,
      accessor: (value: ReachabilityInsights) => formatDistance(value.totalBranchKm),
    },
    {
      key: 'longest',
      label: walkingFocus ? 'Longest walk' : 'Longest branch',
      icon: Compass,
      accessor: (value: ReachabilityInsights) => formatDistance(value.longestBranchKm),
    },
    {
      key: 'branches',
      label: walkingFocus ? 'Paths sampled' : 'Routes sampled',
      icon: Activity,
      accessor: (value: ReachabilityInsights) => `${value.branchCount}/${value.sampledCount}`,
    },
  ];

  if (!insights) {
    return (
      <section className="insights-panel insights-panel--empty">
        <div className="section-heading">
          <span className="section-heading__eyebrow">Insights</span>
          <h2>{walkingFocus ? 'Generate a walkshed' : 'Generate a reach study'}</h2>
        </div>
        <p>
          {walkingFocus
            ? 'Results surface area, traced distance, sampled branches, and the farthest direct walk.'
            : 'Results surface area, traced distance, sampled branches, and the longest explored corridor.'}
        </p>
      </section>
    );
  }

  return (
    <section className="insights-panel">
      <div className="section-heading">
        <span className="section-heading__eyebrow">Insights</span>
        <h2>
          {walkingFocus
            ? provider === 'demo'
              ? 'Demo walkshed'
              : 'Live walkshed'
            : provider === 'demo'
              ? 'Demo estimate'
              : 'Live network result'}
        </h2>
      </div>

      <div className="insight-grid">
        {insightItems.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.key} className="insight-card">
              <div className="insight-card__icon">
                <Icon size={16} />
              </div>
              <span className="insight-card__label">{item.label}</span>
              <strong>{item.accessor(insights)}</strong>
            </article>
          );
        })}
      </div>

      <div className="result-meta-row">
        <span>{formatMode(mode)}</span>
        <span>{provider ? formatProviderLabel(provider) : 'No result yet'}</span>
        {generatedAt ? <span>{buildRelativeTimestamp(generatedAt)}</span> : null}
      </div>
    </section>
  );
}
