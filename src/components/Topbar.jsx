import { useEffect, useRef, useState } from "react";
import "./Topbar.css";

/**
 * Topbar — Fixed navigation bar.
 *
 * Contains:
 *  - View tabs: "Country Search" | "War/Protest"
 *  - Country search input + dropdown (only shown in globe/country-search view)
 *  - Markets toggle button
 */
export default function Topbar({
  value,
  onChange,
  results,
  onSelectCountry,
  isOpen,
  setIsOpen,
  activeView,
  onViewChange,
  isMarketsOpen = false,
  onToggleMarkets,
}) {
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  useEffect(() => {
    if (!isOpen || !inputRef.current) return;

    const updatePosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, value, results.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  return (
    <div className="topbar">
      {/* Country search — far left, only visible in globe view */}
      {activeView === "globe" && (
        <div className="topbar__box" ref={dropdownRef}>
          <input
            ref={inputRef}
            className="topbar__search"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search country…"
          />

          {isOpen && results.length > 0 && (
            <div className="topbar__dropdown" style={dropdownStyle || undefined}>
              {results.map((country) => (
                <div
                  key={country.properties.name}
                  className="topbar__item"
                  onClick={() => onSelectCountry(country)}
                >
                  {country.properties.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View navigation tabs */}
      <nav className="topbar__nav">
        <button
          className={`topbar__nav-btn${activeView === "globe" ? " topbar__nav-btn--active" : ""}`}
          onClick={() => onViewChange("globe")}
        >
          Country Search
        </button>
        <button
          className={`topbar__nav-btn${activeView === "warprotest" ? " topbar__nav-btn--active" : ""}`}
          onClick={() => onViewChange("warprotest")}
        >
          War / Protest
        </button>
      </nav>

      <button
        className={`topbar__markets-btn ${isMarketsOpen ? "topbar__markets-btn--active" : ""}`}
        onClick={onToggleMarkets}
      >
        Markets
      </button>
    </div>
  );
}
