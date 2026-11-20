'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { cronTool, evaluate, initialState } from '@/tool/tool-definition';
import type { CronState } from '@/tool/types';
import { parseCron, computeNextRuns, computeHeatmap, applyDayFieldMode } from '@/lib/cron-parser';
import { CronCanvas } from '@/tool/components/Canvas';
import { CronToolbar } from '@/tool/components/Toolbar';
import { CronSidebar } from '@/tool/components/Sidebar';
import { toolConfig } from '@/tool/tool.config';

export default function ToolClient() {
  const [state, setState] = useState<CronState>(initialState);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const loadedUrl = useRef(false);

  const showToast = useCallback((message: string, kind: 'success' | 'error') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  // Load shared state from URL once.
  useEffect(() => {
    if (loadedUrl.current) return;
    loadedUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('state');
    if (encoded) {
      try {
        const serialized = decompressFromEncodedURIComponent(encoded);
        if (!serialized) throw new Error('Invalid shared URL');
        const raw: unknown = JSON.parse(serialized);
        const result = cronTool.deserialize(raw);
        if (!result.success) throw new Error(result.error);
        setState({ ...initialState, ...result.data });
        showToast('Loaded state from shared URL', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to load shared URL', 'error');
      }
      return;
    }
    // Theme persisted in URL state: prefer ?theme= if present.
    const theme = params.get('theme');
    if (theme === 'light' || theme === 'dark') {
      setState((s) => ({ ...s, theme }));
    }
  }, [showToast]);

  // Keep ?theme= in the URL on toggle (persisted URL state).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('theme') !== state.theme) {
      url.searchParams.set('theme', state.theme);
      window.history.replaceState(null, '', url.toString());
    }
  }, [state.theme]);

  const parsed = useMemo(() => parseCron(state.expression), [state.expression]);

  const nextRuns = useMemo(() => {
    if (!parsed.fields) return [];
    try {
      return computeNextRuns(parsed.fields, state.timezone, Date.now(), 10);
    } catch {
      return [];
    }
  }, [parsed, state.timezone]);

  const heatmap = useMemo(() => {
    if (!parsed.fields) return { cells: [], dayLabels: [] };
    try {
      return computeHeatmap(parsed.fields, state.timezone, Date.now(), 7);
    } catch {
      return { cells: [], dayLabels: [] };
    }
  }, [parsed, state.timezone]);

  const onStateChange = useCallback((patch: Partial<CronState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const onApplyDayFieldMode = useCallback((mode: 'dom' | 'dow') => {
    setState((prev) => {
      const { expression, error } = applyDayFieldMode(prev.expression, mode);
      return { ...prev, expression, error: error ?? null, dayFieldMode: mode };
    });
  }, []);

  const onCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(label, 'success');
      } catch {
        showToast('Clipboard write failed', 'error');
      }
    },
    [showToast]
  );

  return (
    <div className={`cron-app cron-${state.theme}`} data-tool-id={toolConfig.id}>
      <header className="cron-header">
        <h1>{toolConfig.name}</h1>
        <p className="cron-tagline">{toolConfig.description}</p>
      </header>
      <CronToolbar
        state={state}
        onStateChange={onStateChange}
        onApplyDayFieldMode={onApplyDayFieldMode}
      />
      <div className="cron-body">
        <CronSidebar state={state} onStateChange={onStateChange} />
        <main className="cron-main">
          <CronCanvas
            state={{
              ...state,
              error: parsed.error ?? null,
              warnings: state.error ? [] : (parsed.warnings ?? []),
            }}
            nextRuns={nextRuns}
            cells={heatmap.cells}
            dayLabels={heatmap.dayLabels}
            onCopy={onCopy}
          />
        </main>
      </div>
      {toast && (
        <div
          className={`cron-toast cron-toast-${toast.kind}`}
          role="status"
          data-testid="cron-toast"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export { evaluate };
