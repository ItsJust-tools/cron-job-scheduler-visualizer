import type { Tool } from '@itsjust/core';
import toolConfig from './tool.config';
import type { CronState } from './types';
import { parseCron, computeNextRuns, PRESETS, type NextRun } from '../lib/cron-parser';

function isCronState(value: unknown): value is CronState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<CronState>;
  return (
    typeof v.expression === 'string' &&
    typeof v.useSeconds === 'boolean' &&
    (v.dayFieldMode === 'dom' || v.dayFieldMode === 'dow') &&
    typeof v.timezone === 'string' &&
    (v.theme === 'dark' || v.theme === 'light') &&
    Array.isArray(v.warnings) &&
    (v.error === null || typeof v.error === 'string')
  );
}

export const initialState: CronState = {
  expression: '*/15 9-17 * * 1-5',
  useSeconds: false,
  dayFieldMode: 'dom',
  timezone: 'UTC',
  theme: 'dark',
  warnings: [],
  error: null,
  nextRunsJSON: '',
  selectedPreset: 'Weekdays 9-5 every 15min',
};

export const cronTool: Tool<CronState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState,
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): import('@itsjust/core').DeserializeResult<CronState> => {
    try {
      if (isCronState(data)) return { success: true, data };
      return { success: false, error: 'Invalid data format: expected valid cron visualizer state' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
};

export function evaluate(
  state: CronState,
  now: number = Date.now(),
  count = 10
): CronState & { nextRuns: NextRun[] } {
  const parsed = parseCron(state.expression);
  if (parsed.error || !parsed.fields) {
    return {
      ...state,
      error: parsed.error ?? 'Invalid cron expression',
      warnings: [],
      nextRuns: [],
    };
  }
  const nextRuns: NextRun[] = computeNextRuns(parsed.fields, state.timezone, now, count);
  return { ...state, error: null, warnings: parsed.warnings ?? [], nextRuns };
}

export class CronToolDefinition {
  initialState: CronState = cronTool.initialState;

  serialize(state: CronState): string {
    return cronTool.serialize(state);
  }

  deserialize(data: unknown): import('@itsjust/core').DeserializeResult<CronState> {
    return cronTool.deserialize(data);
  }

  evaluate(state: CronState, now?: number): CronState & { nextRuns: NextRun[] } {
    return evaluate(state, now);
  }
}

export { PRESETS };
