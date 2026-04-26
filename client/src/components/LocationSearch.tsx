import { Search, LoaderCircle } from 'lucide-react';
import type { GeocodeResult } from '@roadreach/contracts';

type LocationSearchProps = {
  value: string;
  results: GeocodeResult[];
  isSearching: boolean;
  helper: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodeResult) => void;
};

export function LocationSearch({
  value,
  results,
  isSearching,
  helper,
  onChange,
  onSelect,
}: LocationSearchProps) {
  const showResults = value.trim().length >= 2;

  return (
    <div className="search-shell">
      <label className="field-label" htmlFor="location-search">
        Walk start
      </label>
      <div className="search-input-wrap">
        <Search className="field-icon" size={18} />
        <input
          id="location-search"
          className="search-input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search place or address"
          autoComplete="off"
        />
        {isSearching ? <LoaderCircle className="spin" size={18} /> : null}
      </div>
      <p className="field-helper">{helper}</p>

      {showResults ? (
        <div className="search-results" role="listbox" aria-label="Location matches">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="search-result"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(result)}
              >
                <span className="search-result__name">{result.name}</span>
                <span className="search-result__label">{result.label}</span>
              </button>
            ))
          ) : (
            <div className="search-results__empty">
              {isSearching ? 'Searching…' : 'No matching places yet.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
