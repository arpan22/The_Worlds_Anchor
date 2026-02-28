/**
 * FilterBar — War/Protest filter controls
 *
 * Loads the country list from /api/acled/countries (sourced from the local xlsx).
 * Falls back to a hardcoded curated list if the endpoint fails.
 */
import { useState, useEffect, useRef } from 'react';
import './FilterBar.css';

const RANGE_PRESETS = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '1W' },
  { value: '30d', label: '1M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
];

// Curated fallback (used if server endpoint fails)
const FALLBACK_COUNTRIES = [
  'Afghanistan', 'Cameroon', 'Democratic Republic of Congo', 'Egypt',
  'Ethiopia', 'Haiti', 'India', 'Iraq', 'Israel', 'Libya', 'Mali',
  'Mexico', 'Mozambique', 'Myanmar', 'Nigeria', 'Pakistan',
  'Russia', 'Somalia', 'South Sudan', 'Sudan', 'Syria',
  'Ukraine', 'United States', 'Yemen',
];

export default function FilterBar({ filters, onFiltersChange, total, isLoading }) {
  const [countryList, setCountryList] = useState(FALLBACK_COUNTRIES);
  const [countrySuggestionsOpen, setCountrySuggestionsOpen] = useState(false);
  const [countryInput, setCountryInput] = useState(filters.country || '');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const countryWrapRef = useRef(null);
  const countryInputRef = useRef(null);

  useEffect(() => {
    setCountryInput(filters.country || '');
  }, [filters.country]);

  // Load full country list from server (comes from the xlsx data)
  useEffect(() => {
    fetch('/api/acled/countries')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.countries) && data.countries.length > 0) {
          setCountryList(data.countries);
        }
      })
      .catch(() => {}); // silently fall back to hardcoded list
  }, []);

  const filteredSuggestions =
    countryInput.length >= 1
      ? countryList.filter((c) =>
          c.toLowerCase().startsWith(countryInput.toLowerCase())
        )
      : countryList.slice(0, 40);

  useEffect(() => {
    if (!countrySuggestionsOpen || !countryInputRef.current) return;

    const updatePosition = () => {
      if (!countryInputRef.current) return;
      const rect = countryInputRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [countrySuggestionsOpen, countryInput, countryList.length]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryWrapRef.current && !countryWrapRef.current.contains(event.target)) {
        setCountrySuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const update = (patch) => onFiltersChange({ ...filters, ...patch });

  const handleCountrySelect = (name) => {
    setCountryInput(name);
    setCountrySuggestionsOpen(false);
    update({ country: name });
  };

  const handleCountryInputChange = (e) => {
    const val = e.target.value;
    setCountryInput(val);
    setCountrySuggestionsOpen(true);
    update({ country: val });
  };

  return (
    <div className="warpro-filters">
      {/* Country */}
      <div
        ref={countryWrapRef}
        className="warpro-filters__group warpro-filters__country-wrap"
      >
        <label className="warpro-filters__label">Country</label>
        <input
          ref={countryInputRef}
          className="warpro-filters__input"
          value={countryInput}
          onChange={handleCountryInputChange}
          onFocus={() => setCountrySuggestionsOpen(true)}
          placeholder="All countries"
          autoComplete="off"
        />
        {countrySuggestionsOpen && filteredSuggestions.length > 0 && (
          <div
            className="warpro-filters__suggestions"
            style={dropdownStyle || undefined}
          >
            {filteredSuggestions.map((name) => (
              <div
                key={name}
                className="warpro-filters__suggestion-item"
                onMouseDown={() => handleCountrySelect(name)}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="warpro-filters__group warpro-filters__group--range">
        <label className="warpro-filters__label">Range</label>
        <div className="warpro-filters__range-pills">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`warpro-filters__range-pill${filters.range_preset === preset.value ? ' warpro-filters__range-pill--active' : ''}`}
              onClick={() => update({ range_preset: preset.value })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actor search */}
      <div className="warpro-filters__group">
        <label className="warpro-filters__label">Actor</label>
        <input
          className="warpro-filters__input"
          value={filters.actor}
          onChange={(e) => update({ actor: e.target.value })}
          placeholder="Search actor…"
        />
      </div>

      {/* Results badge */}
      <div className="warpro-filters__status">
        {isLoading ? (
          <span className="warpro-filters__loading">Loading…</span>
        ) : (
          <span className="warpro-filters__count">
            {total.toLocaleString()} event{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
