export function Legend() {
  return (
    <div className="legend-card">
      <div className="legend-row">
        <span className="legend-swatch legend-swatch--fill" />
        <span>Reachable envelope</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch legend-swatch--branch" />
        <span>Sampled road reach</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch legend-swatch--origin" />
        <span>Origin point</span>
      </div>
    </div>
  );
}
