import './SettingsPanel.css';

/**
 * SettingsPanel — Controls for Gemini fallback, token limits, and cache.
 *
 * Rendered as a modal overlay. Settings are persisted in localStorage
 * and passed to the backend with each chat request.
 */
export default function SettingsPanel({ settings, onChange, onClose }) {
  function update(key, value) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal__header">
          <h2 className="settings-modal__title">Settings</h2>
          <button className="settings-modal__close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>

        <div className="settings-modal__body">
          {/* Gemini toggle */}
          <div className="settings-group">
            <h3 className="settings-group__title">Gemini Web Fallback</h3>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.geminiEnabled}
                onChange={(e) => update('geminiEnabled', e.target.checked)}
              />
              <span className="settings-toggle__slider" />
              <span className="settings-toggle__label">
                {settings.geminiEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
            <p className="settings-group__hint">
              When enabled, Gemini searches the web if news context is insufficient.
              Results are compressed and passed to Nemotron for the final answer.
            </p>
          </div>

          {/* Token limits */}
          <div className="settings-group">
            <h3 className="settings-group__title">Token Limits</h3>

            <div className="settings-slider">
              <label className="settings-slider__label">
                Gemini max output tokens
                <span className="settings-slider__value">{settings.geminiMaxOutputTokens}</span>
              </label>
              <input
                type="range"
                min={200}
                max={2000}
                step={100}
                value={settings.geminiMaxOutputTokens}
                onChange={(e) => update('geminiMaxOutputTokens', parseInt(e.target.value, 10))}
                disabled={!settings.geminiEnabled}
              />
            </div>

            <div className="settings-slider">
              <label className="settings-slider__label">
                Nemotron max context tokens
                <span className="settings-slider__value">{settings.nemotronMaxContextTokens}</span>
              </label>
              <input
                type="range"
                min={1000}
                max={8000}
                step={500}
                value={settings.nemotronMaxContextTokens}
                onChange={(e) => update('nemotronMaxContextTokens', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* Cache duration */}
          <div className="settings-group">
            <h3 className="settings-group__title">Cache Duration</h3>
            <div className="settings-slider">
              <label className="settings-slider__label">
                Session cache (minutes)
                <span className="settings-slider__value">{settings.cacheDurationMinutes} min</span>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={settings.cacheDurationMinutes}
                onChange={(e) => update('cacheDurationMinutes', parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        <footer className="settings-modal__footer">
          <button className="settings-modal__done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
