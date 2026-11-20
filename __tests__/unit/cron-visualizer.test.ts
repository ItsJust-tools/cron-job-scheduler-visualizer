import { describe, it, expect } from 'vitest';
import {
  parseCron,
  computeNextRuns,
  matchesDay,
  applyDayFieldMode,
  PRESETS,
} from '@/lib/cron-parser';
import { CronToolDefinition, evaluate, initialState } from '@/tool/tool-definition';
import type { CronState } from '@/tool/types';

describe('cron parser: business hours schedule', () => {
  it("parses '*/15 9-17 * * 1-5' to correct fire minutes in business hours on weekdays", () => {
    const res = parseCron('*/15 9-17 * * 1-5');
    expect(res.error).toBeUndefined();
    const fields = res.fields!;
    expect(fields!.minutes).toEqual([0, 15, 30, 45]);
    expect(fields!.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(fields!.dows).toEqual([1, 2, 3, 4, 5]);
    expect(fields!.dowRestricted).toBe(true);
    expect(fields!.domRestricted).toBe(false);

    // A Wednesday 10:45 local in UTC must fire; Saturday 10:45 must not.
    const wed = Date.UTC(2026, 10, 18, 10, 45, 0); // 2026-11-18 is a Wednesday
    const runs = computeNextRuns(fields, 'UTC', wed - 61_000, 5);
    expect(runs[0]!.utc).toBe(wed);
    const sat = Date.UTC(2026, 10, 21, 10, 45, 0); // Saturday
    const satRuns = computeNextRuns(fields, 'UTC', sat - 61_000, 1);
    expect(satRuns[0]!.utc).toBe(Date.UTC(2026, 10, 23, 9, 0, 0)); // next Monday 09:00
  });
});

describe('timezone and DST', () => {
  it('next-run computation respects timezone', () => {
    const fields = parseCron('0 12 * * *').fields!;
    // Tokyo is UTC+9: local noon = 03:00 UTC.
    const after = Date.UTC(2026, 0, 1, 0, 0, 0);
    const runs = computeNextRuns(fields, 'Asia/Tokyo', after, 1);
    expect(runs[0]!.utc).toBe(Date.UTC(2026, 0, 1, 3, 0, 0));
    // New York in January (UTC-5): local noon = 17:00 UTC.
    const nyRuns = computeNextRuns(fields, 'America/New_York', after, 1);
    expect(nyRuns[0]!.utc).toBe(Date.UTC(2026, 0, 1, 17, 0, 0));
  });

  it('returns the same local schedule after a DST shift', () => {
    const fields = parseCron('30 8 * * *').fields!;
    // America/New_York: DST ends 2026-11-01 (EDT UTC-4 -> EST UTC-5).
    const before = computeNextRuns(fields, 'America/New_York', Date.UTC(2026, 9, 30, 0, 0, 0), 3);
    const after = computeNextRuns(fields, 'America/New_York', Date.UTC(2026, 10, 3, 0, 0, 0), 3);
    // Every run must land at 08:30 local time.
    for (const r of [...before, ...after]) {
      expect(new Date(r.utc).toISOString()).toMatch(/T1[23]:30:00|T13:30:00/);
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(r.utc));
      expect(p).toBe('08:30');
    }
    // UTC hour changes across the transition (12:30Z -> 13:30Z).
    const beforeUtcHours = before.map((r) => new Date(r.utc).getUTCHours());
    const afterUtcHours = after.map((r) => new Date(r.utc).getUTCHours());
    expect(beforeUtcHours).toContain(12);
    expect(afterUtcHours).toContain(13);
  });
});

describe('invalid input handling', () => {
  const def = new CronToolDefinition();
  const cases = [
    '',
    '   ',
    '*/15 9-17 * * 1-5 * *',
    '61 * * * *',
    '* 25 * * *',
    'foo * * * *',
    '*/0 * * * *',
    '5-1 * * * *',
  ];
  for (const expr of cases) {
    it(`shows a descriptive error for "${expr}" and does not crash`, () => {
      const res = def.evaluate({ ...initialState, expression: expr });
      expect(res.error).toBeTruthy();
      expect(typeof res.error).toBe('string');
      expect(res.error!.length).toBeGreaterThan(3);
    });
  }

  it('UI-facing parse result carries the error, canvas state keeps prior content', () => {
    const res = parseCron('banana');
    expect(res.error).toBeDefined();
    expect(res.fields).toBeUndefined();
  });
});

describe('day-of-month vs day-of-week OR semantics', () => {
  it('both restricted -> union of matching dates fires', () => {
    const fields = parseCron('0 0 1 * 1').fields!; // day 1 of month OR any Monday
    // 2026-11-01 is a Sunday with dom 1: fires via dom match (OR semantics).
    expect(matchesDay(fields, 2026, 11, 1, 0)).toBe(true); // dom 1
    expect(matchesDay(fields, 2026, 11, 2, 1)).toBe(true); // Monday
    expect(matchesDay(fields, 2026, 11, 16, 1)).toBe(true); // Monday
    expect(matchesDay(fields, 2026, 11, 3, 2)).toBe(false); // dom 3, Tuesday: neither
    // Dec 1 2026 is a Tuesday: fires via dom.
    expect(matchesDay(fields, 2026, 12, 1, 2)).toBe(true);
  });

  it('only dom restricted fires purely on dom', () => {
    const fields = parseCron('0 0 15 * *').fields!;
    expect(matchesDay(fields, 2026, 11, 15, 0)).toBe(true);
    expect(matchesDay(fields, 2026, 11, 14, 0)).toBe(false);
  });

  it('toggling day field mode rewrites the right fields', () => {
    expect(applyDayFieldMode('15 10 20 * *', 'dow').expression).toBe('15 10 * * *');
    const dom = applyDayFieldMode('0 0 * * 3', 'dom');
    expect(dom.expression).toBe('0 0 * * *');
  });
});

describe('leap day edge case', () => {
  it('Feb 29 fires only in leap years with a warning', () => {
    const res = parseCron('0 0 29 2 *');
    expect(res.warnings?.some((w) => w.toLowerCase().includes('leap'))).toBe(true);
    const fields = res.fields!;
    const after = Date.UTC(2024, 2, 1, 0, 0, 0); // after 2024-02-29
    const runs = computeNextRuns(fields, 'UTC', after, 1);
    expect(runs[0]!.utc).toBe(Date.UTC(2028, 1, 29, 0, 0, 0));
  });
});

describe('6-field expressions with seconds', () => {
  it('parses seconds field and fires on exact seconds', () => {
    const fields = parseCron('*/30 0 12 * * *').fields!;
    expect(fields.useSeconds).toBe(true);
    expect(fields.seconds).toEqual([0, 30]);
    const runs = computeNextRuns(fields, 'UTC', Date.UTC(2026, 5, 1, 11, 59, 30), 3);
    expect(runs.map((r) => r.utc)).toEqual([
      Date.UTC(2026, 5, 1, 12, 0, 0),
      Date.UTC(2026, 5, 1, 12, 0, 30),
      Date.UTC(2026, 5, 2, 12, 0, 0),
    ]);
  });
});

describe('presets', () => {
  it('preset library parses cleanly', () => {
    for (const p of PRESETS) {
      const res = parseCron(p.expression);
      expect(res.error).toBeUndefined();
    }
  });
});

describe('state serialization', () => {
  const def = new CronToolDefinition();
  it('round-trips state', () => {
    const state: CronState = {
      ...initialState,
      expression: '0 2 * * *',
      timezone: 'Asia/Tokyo',
      theme: 'light',
    };
    const json = def.serialize(state);
    const back = def.deserialize(JSON.parse(json));
    expect(back.success).toBe(true);
    if (back.success) expect(back.data).toEqual(state);
  });

  it('rejects invalid state', () => {
    expect(def.deserialize({ expression: 42 }).success).toBe(false);
    expect(def.deserialize(null).success).toBe(false);
  });

  it('evaluate computes nextRuns for valid state', () => {
    const res = def.evaluate(
      { ...initialState, expression: '0 2 * * *' },
      Date.UTC(2026, 0, 1, 0, 0, 0)
    );
    expect(res.error).toBeNull();
    expect(res.nextRuns.length).toBe(10);
    expect(res.nextRuns[0]!.utc).toBe(Date.UTC(2026, 0, 1, 2, 0, 0));
  });
});
