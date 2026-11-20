import { describe, it, expect } from 'vitest';
import { CronToolDefinition, evaluate, initialState } from '@/tool/tool-definition';
import type { CronState } from '@/tool/types';

describe('CronToolDefinition', () => {
  const def = new CronToolDefinition();

  it('evaluates a valid expression to next runs', () => {
    const state: CronState = { ...initialState, expression: '0 2 * * *' };
    const res = def.evaluate(state, Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(res.error).toBeNull();
    expect(res.nextRuns.length).toBe(10);
    expect(res.nextRuns[0]!.utc).toBe(Date.UTC(2026, 0, 1, 2, 0, 0));
  });

  it('reports errors for invalid expressions', () => {
    const state: CronState = { ...initialState, expression: '61 * * * *' };
    const res = def.evaluate(state);
    expect(res.error).not.toBeNull();
  });

  it('adds warnings for wildcard conflicts', () => {
    const res = evaluate({ ...initialState, expression: '0 0 1 * 1' });
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('round-trips state through serialize/deserialize', () => {
    const state: CronState = {
      ...initialState,
      expression: '5 4 * * 1',
      timezone: 'Europe/Berlin',
    };
    const json = def.serialize(state);
    const back = def.deserialize(JSON.parse(json));
    expect(back.success).toBe(true);
    if (back.success) expect(back.data).toEqual(state);
  });
});
