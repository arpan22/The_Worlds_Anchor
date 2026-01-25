import "./Topbar.css";

export default function Topbar({ value, onChange }) {
  return (
    <div className="topbar">
      <input
        className="topbar__search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
      />
    </div>
  );
}
