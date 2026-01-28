import "./CountryPanel.css";

export default function CountryPanel({ country, onClose }) {
  if (!country) return null;

  return (
    <aside className="panel panel--open">
      <button className="panel__close" onClick={onClose}>×</button>
      <h2 className="panel__title">{country.properties?.name}</h2>
      <div className="panel__body">
        <div>id: {country.id ?? "n/a"}</div>
      </div>
    </aside>
  );
}
