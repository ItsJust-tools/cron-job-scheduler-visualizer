import { CronState } from '../types';
import { NextRun } from '../../lib/cron-parser';

interface CronCanvasProps {
  state: CronState;
  nextRuns: NextRun[];
  cells: { day: string; hour: number; count: number }[];
  dayLabels: string[];
  onCopy: (text: string, label: string) => void;
}

const TIMEZONES = [
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
];

export function CronCanvas({ state, nextRuns, cells, dayLabels, onCopy }: CronCanvasProps) {
  const dark = state.theme === 'dark';
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  const copyAs = (format: 'json' | 'text') => {
    if (format === 'json') {
      onCopy(
        JSON.stringify(
          nextRuns.map((r) => ({ utc: r.utc, iso: r.iso, local: r.label })),
          null,
          2
        ),
        'Next runs copied as JSON'
      );
    } else {
      onCopy(nextRuns.map((r, i) => `${i + 1}. ${r.label}`).join('\n'), 'Next runs copied as text');
    }
  };

  return (
    <div
      className={`cron-canvas ${dark ? 'cron-dark' : 'cron-light'}`}
      role="application"
      aria-label="Cron schedule visualizer"
      data-testid="cron-canvas"
    >
      {state.error ? (
        <div className="cron-error" role="alert" data-testid="cron-error">
          Invalid expression: {state.error}
        </div>
      ) : (
        <>
          {state.warnings.length > 0 && (
            <div className="cron-warnings" data-testid="cron-warnings">
              {state.warnings.map((w, i) => (
                <div key={i} className="cron-warning" role="status">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}

          <section className="cron-section" aria-label="Next scheduled runs">
            <div className="cron-section-head">
              <h3>Next runs ({state.timezone})</h3>
              <div className="cron-copy-buttons">
                <button onClick={() => copyAs('json')} aria-label="Copy next runs as JSON">
                  Copy JSON
                </button>
                <button onClick={() => copyAs('text')} aria-label="Copy next runs as plain text">
                  Copy text
                </button>
              </div>
            </div>
            {nextRuns.length === 0 ? (
              <p className="cron-empty">No upcoming runs within the search window.</p>
            ) : (
              <ol className="cron-runs" data-testid="next-runs">
                {nextRuns.map((r, i) => (
                  <li key={r.utc}>
                    <span className="cron-run-index">{i + 1}</span>
                    <span className="cron-run-label">{r.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="cron-section" aria-label="Weekly fire-time heatmap">
            <h3>Fire-time heatmap (next 7 days × 24h)</h3>
            <div className="cron-heatmap" data-testid="cron-heatmap">
              <div className="cron-heatmap-hours" aria-hidden="true">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="cron-heatmap-hour-label">
                    {h.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
              {dayLabels.map((label, di) => (
                <div key={di} className="cron-heatmap-row">
                  <span className="cron-heatmap-day-label">{label}</span>
                  <div className="cron-heatmap-cells">
                    {cells.slice(di * 24, di * 24 + 24).map((c, hi) => (
                      <div
                        key={hi}
                        className="cron-heatmap-cell"
                        title={`${c.day} ${String(c.hour).padStart(2, '0')}:00 — ${c.count} fire${c.count === 1 ? '' : 's'}`}
                        style={{
                          backgroundColor:
                            c.count === 0
                              ? 'transparent'
                              : `rgba(59,130,246,${0.2 + 0.8 * (c.count / maxCount)})`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export { TIMEZONES };
