import { useEffect, useRef } from "react";
import "./Topbar.css";

export default function Topbar({
  value,
  onChange,
  results,
  onSelectCountry,
  isOpen,
  setIsOpen,
}) {
  const dropdownRef = useRef(null);

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
    <div className="topbar" ref={dropdownRef}>
      <div className="topbar__box">
        <input
          className="topbar__search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search…"
        />

        {isOpen && results.length > 0 && (
          <div className="topbar__dropdown">
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
    </div>
  );
}
