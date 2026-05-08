import { useEffect, useId, useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';
import type { GeocodeResult } from '@roadreach/contracts';

type LocationSearchProps = {
  value: string;
  results: GeocodeResult[];
  isSearching: boolean;
  helper: string;
  selectedLabel?: string | null;
  onChange: (value: string) => void;
  onSelect: (result: GeocodeResult) => void;
};

export function LocationSearch({
  value,
  results,
  isSearching,
  helper,
  selectedLabel,
  onChange,
  onSelect,
}: LocationSearchProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const normalizedValue = value.trim().toLowerCase();
  const showResults =
    value.trim().length >= 2 &&
    normalizedValue !== (selectedLabel ?? '').trim().toLowerCase();
  const isOpen = showResults && (results.length > 0 || isSearching);

  useEffect(() => {
    if (!showResults || results.length === 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((current) => {
      if (current >= 0 && current < results.length) {
        return current;
      }

      return 0;
    });
  }, [results, showResults]);

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
          onKeyDown={(event) => {
            if (!showResults || results.length === 0) {
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % results.length);
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + results.length) % results.length);
              return;
            }

            if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              onSelect(results[activeIndex]);
              return;
            }

            if (event.key === 'Escape') {
              setActiveIndex(-1);
            }
          }}
          placeholder="Search place or address"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 && results[activeIndex]
              ? `${listboxId}-${results[activeIndex].id}`
              : undefined
          }
        />
        {isSearching ? <LoaderCircle className="spin" size={18} /> : null}
      </div>
      <p className="field-helper">{helper}</p>

      {showResults ? (
        <div className="search-results" role="listbox" id={listboxId} aria-label="Location matches">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.id}
                id={`${listboxId}-${result.id}`}
                type="button"
                role="option"
                className={`search-result ${activeIndex === index ? 'is-active' : ''}`}
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
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
