import { CronState } from '../types';
import { PRESETS } from '../../lib/cron-parser';

interface CronToolbarProps {
  state: CronState;
  onStateChange: (patch: Partial<CronState>) => void;
  onApplyDayFieldMode: (mode: 'dom' | 'dow') => void;
}

export function CronToolbar({ state, onStateChange, onApplyDayFieldMode }: CronToolbarProps) {
  const dark = state.theme === 'dark';
  return (
    <div className={`cron-toolbar ${dark ? 'cron-dark' : 'cron-light'}`} data-testid="cron-toolbar">
      <input
        className="cron-expression-input"
        type="text"
        value={state.expression}
        onChange={(e) => onStateChange({ expression: e.target.value, selectedPreset: null })}
        aria-label="Cron expression"
        placeholder="*/15 9-17 * * 1-5"
        spellCheck={false}
      />
      <select
        className="cron-tz-select"
        value={state.timezone}
        onChange={(e) => onStateChange({ timezone: e.target.value })}
        aria-label="Timezone"
      >
        {[
          'UTC',
          'Europe/Berlin',
          'Europe/London',
          'America/New_York',
          'America/Chicago',
          'America/Los_Angeles',
          'Asia/Tokyo',
          'Asia/Kolkata',
          'Australia/Sydney',
          'Pacific/Auckland',
        ].map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <div className="cron-mode-toggle" role="group" aria-label="Day field mode">
        <button
          className={state.dayFieldMode === 'dom' ? 'active' : ''}
          onClick={() => onApplyDayFieldMode('dom')}
          aria-pressed={state.dayFieldMode === 'dom'}
        >
          Day of month
        </button>
        <button
          className={state.dayFieldMode === 'dow' ? 'active' : ''}
          onClick={() => onApplyDayFieldMode('dow')}
          aria-pressed={state.dayFieldMode === 'dow'}
        >
          Day of week
        </button>
      </div>
      <button
        className="cron-theme-toggle"
        onClick={() => onStateChange({ theme: dark ? 'light' : 'dark' })}
        aria-label="Toggle theme"
        data-testid="theme-toggle"
      >
        {dark ? '☀ Light' : '🌙 Dark'}
      </button>
    </div>
  );
}

export const PRESET_LIST = PRESETS;
