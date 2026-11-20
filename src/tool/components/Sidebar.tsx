import { CronState } from '../types';
import { PRESETS } from '../../lib/cron-parser';

interface CronSidebarProps {
  state: CronState;
  onStateChange: (patch: Partial<CronState>) => void;
}

export function CronSidebar({ state, onStateChange }: CronSidebarProps) {
  const dark = state.theme === 'dark';
  return (
    <div className={`cron-sidebar ${dark ? 'cron-dark' : 'cron-light'}`} data-testid="cron-sidebar">
      <h3>Presets</h3>
      <ul className="cron-preset-list" aria-label="Preset schedules">
        {PRESETS.map((p) => (
          <li key={p.name}>
            <button
              className={state.selectedPreset === p.name ? 'active' : ''}
              onClick={() => {
                onStateChange({ expression: p.expression, selectedPreset: p.name, error: null });
              }}
              title={p.description}
            >
              <span className="cron-preset-name">{p.name}</span>
              <code className="cron-preset-expr">{p.expression}</code>
            </button>
          </li>
        ))}
      </ul>
      <label className="cron-seconds-toggle">
        <input
          type="checkbox"
          checked={state.useSeconds}
          onChange={(e) => onStateChange({ useSeconds: e.target.checked })}
        />
        6-field mode (with seconds)
      </label>
      <div className="cron-hint">
        Schedule with seconds uses 6 fields: <code>sec min hour dom mon dow</code>
      </div>
    </div>
  );
}
