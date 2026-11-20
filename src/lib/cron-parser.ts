/**
 * Cron expression parsing and next-run computation (pure, dependency-free).
 * Supports 5-field expressions (m h dom mon dow) and 6-field with seconds
 * (s m h dom mon dow). Follows classic cron OR semantics: when both
 * day-of-month and day-of-week are restricted, a date matching either fires.
 */

export interface CronFields {
  seconds: number[]; // when useSeconds, else [0]
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[]; // 0=Sunday .. 6=Saturday, 7 normalized to 0
  domRestricted: boolean;
  dowRestricted: boolean;
  useSeconds: boolean;
  raw: string;
}

export interface ParseResult {
  fields?: CronFields;
  error?: string;
  warnings?: string[];
}

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseFieldPart(part: string, min: number, max: number, names?: string[]): number | null {
  const lower = part.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(lower) || !names) return null;
  const idx = names.indexOf(lower);
  if (idx < min || idx > max) return null;
  return idx;
}

function resolveToken(token: string, min: number, max: number, names?: string[]): number | null {
  const numeric = Number(token);
  if (Number.isInteger(numeric)) return numeric;
  return parseFieldPart(token, min, max, names);
}

function expandValues(
  pieces: string[],
  min: number,
  max: number,
  fieldName: string,
  names?: string[]
): { values: number[] | null; error?: string } {
  const values: number[] = [];
  for (const piece of pieces) {
    // Step expressions like "*/15" or "5-20/3"
    let body = piece;
    let step = 1;
    const slash = piece.indexOf('/');
    if (slash >= 0) {
      body = piece.slice(0, slash);
      const stepStr = piece.slice(slash + 1);
      if (!/^\d+$/.test(stepStr) || Number(stepStr) === 0) {
        return {
          values: null,
          error: `Invalid step "/${stepStr}" in ${fieldName} field (must be a positive integer)`,
        };
      }
      step = Number(stepStr);
    }

    let lo: number | null = null;
    let hi: number | null = null;
    if (body === '*') {
      lo = min;
      hi = max;
    } else if (body.includes('-')) {
      const rangeParts = body.split('-');
      if (rangeParts.length !== 2) {
        return { values: null, error: `Invalid range "${body}" in ${fieldName} field` };
      }
      lo = resolveToken(rangeParts[0] as string, min, max, names);
      hi = resolveToken(rangeParts[1] as string, min, max, names);
    } else {
      lo = resolveToken(body, min, max, names);
      if (lo === null) {
        return {
          values: null,
          error: `Invalid value "${body}" in ${fieldName} field (expected ${min}-${max}${names ? ' or a name like ' + names[0] : ''})`,
        };
      }
      hi = body.includes('/') ? max : lo;
    }
    if (lo === null || hi === null) {
      return {
        values: null,
        error: `Invalid value in ${fieldName} field: "${piece}" (expected ${min}-${max})`,
      };
    }
    if (lo > hi) {
      return {
        values: null,
        error: `Reversed range "${body}" in ${fieldName} field (${lo} > ${hi})`,
      };
    }
    for (let v = lo; v <= hi; v += step) {
      if (v < min || v > max) {
        return {
          values: null,
          error: `Value ${v} out of range in ${fieldName} field (expected ${min}-${max})`,
        };
      }
      if (!values.includes(v)) values.push(v);
    }
  }
  if (values.length === 0) {
    return { values: null, error: `${fieldName} field matched no values` };
  }
  return { values: values.sort((a, b) => a - b) };
}

export function parseCron(expression: string): ParseResult {
  const raw = expression.trim();
  if (!raw) {
    return { error: 'Cron expression is empty — enter a schedule like "*/15 9-17 * * 1-5".' };
  }
  const parts = raw.split(/\s+/);
  const useSeconds = parts.length === 6;
  if (parts.length !== 5 && parts.length !== 6) {
    return {
      error: `Expected 5 fields (minute hour day month weekday) or 6 fields with seconds, but got ${parts.length}.`,
    };
  }

  let idx = 0;
  const secPart = (useSeconds ? parts[idx++] : '0') as string;
  const minPart = parts[idx++] as string;
  const hourPart = parts[idx++] as string;
  const domPart = parts[idx++] as string;
  const monPart = parts[idx++] as string;
  const dowPart = parts[idx++] as string;

  const sec = expandValues(secPart.split(','), 0, 59, 'seconds');
  if (sec.error) return { error: sec.error };
  const min = expandValues(minPart.split(','), 0, 59, 'minute');
  if (min.error) return { error: min.error };
  const hour = expandValues(hourPart.split(','), 0, 23, 'hour');
  if (hour.error) return { error: hour.error };
  const dom = expandValues(domPart.split(','), 1, 31, 'day-of-month');
  if (dom.error) return { error: dom.error };
  const mon = expandValues(monPart.split(','), 1, 12, 'month', MONTH_NAMES);
  if (mon.error) return { error: mon.error };
  const dow = expandValues(dowPart.split(','), 0, 7, 'day-of-week', DAY_NAMES);
  if (dow.error) return { error: dow.error };

  const dows = (dow.values as number[]).map((d) => (d === 7 ? 0 : d));

  const fields: CronFields = {
    seconds: sec.values as number[],
    minutes: min.values as number[],
    hours: hour.values as number[],
    doms: dom.values as number[],
    months: mon.values as number[],
    dows,
    domRestricted: domPart.trim() !== '*',
    dowRestricted: dowPart.trim() !== '*',
    useSeconds,
    raw,
  };

  const warnings: string[] = [];
  if (fields.domRestricted && fields.dowRestricted) {
    warnings.push(
      'Both day-of-month and day-of-week are restricted: a day fires if it matches EITHER one (OR semantics).'
    );
  }
  if (domPart.trim() === '29' && monPart.trim() === '2') {
    warnings.push(
      'February 29 only fires in leap years; in common years this schedule never runs.'
    );
  }
  return { fields, warnings };
}

/** Days in a month (1-indexed month). */
export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** Does this schedule fire on the given local date (month1: 1-12, dow: 0-6)? */
export function matchesDay(
  fields: CronFields,
  year: number,
  month1: number,
  dayOfMonth: number,
  dow: number
): boolean {
  if (!fields.months.includes(month1)) return false;
  if (dayOfMonth > daysInMonth(year, month1)) return false;
  const domMatch = fields.domRestricted && fields.doms.includes(dayOfMonth);
  const dowMatch = fields.dowRestricted && fields.dows.includes(dow);
  // Classic cron OR semantics when both are restricted; wildcard means unrestricted.
  if (fields.domRestricted && fields.dowRestricted) return domMatch || dowMatch;
  if (fields.domRestricted) return domMatch;
  if (fields.dowRestricted) return dowMatch;
  return true;
}

/** Local (wall-clock) components of a UTC timestamp in the given IANA timezone. */
export function localParts(
  ts: number,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dow: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ts))) {
    parts[p.type] = p.value;
  }
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    dow: (parts.weekday ? dowMap[parts.weekday] : undefined) ?? new Date(ts).getUTCDay(),
  };
}

/** Convert local wall-clock time in a timezone to a UTC timestamp (handles DST within ±1 day). */
export function localToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): number {
  // Naive guess: treat the wall clock as UTC.
  let ts = Date.UTC(year, month - 1, day, hour, minute, second);
  // Iterate: measure how far the naive-as-UTC instant maps to in local time and correct.
  // Offset = UTC - local-as-UTC for the target zone at this instant.
  const naiveKey = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const l = localParts(ts, timeZone);
    const localAsUTC = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second);
    const diff = localAsUTC - naiveKey; // how much local clock is ahead of target
    if (diff === 0) {
      // Verify the local date still matches the requested wall clock (DST gap check).
      return ts;
    }
    ts = ts - diff;
  }
  return ts;
}

export interface NextRun {
  utc: number;
  label: string;
  iso: string;
}

/**
 * Compute the next `count` fire times after `after` (UTC ms) in `timeZone`.
 * Local wall-clock arithmetic guarantees the schedule fires at the same local
 * times before and after DST transitions. Gaps (skipped local times during
 * spring-forward) simply do not fire.
 */
export function computeNextRuns(
  fields: CronFields,
  timeZone: string,
  after: number,
  count: number,
  maxDays = 760
): NextRun[] {
  const runs: NextRun[] = [];
  // Start from the local date of `after` in the target timezone.
  let cur: { year: number; month: number; day: number } = localParts(after, timeZone);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  for (let dayOffset = 0; dayOffset <= maxDays && runs.length < count; dayOffset++) {
    // Iterate dates proleptically via UTC calendar walking on the local y/m/d.
    const startYear = cur.year;
    const { year, month, day } = cur;
    if (!fields.months.includes(month)) {
      cur = advanceLocalDay(year, month, day);
      continue;
    }
    let d2 = day;
    let y2 = year;
    let m2 = month;
    while (runs.length < count) {
      if (d2 > daysInMonth(y2, m2)) {
        m2 += 1;
        if (m2 > 12) {
          m2 = 1;
          y2 += 1;
        }
        d2 = 1;
        if (!fields.months.includes(m2)) {
          // skip forward through months quickly
          while (!fields.months.includes(m2)) {
            m2 += 1;
            if (m2 > 12) {
              m2 = 1;
              y2 += 1;
            }
          }
          d2 = 1;
        }
        if (y2 > cur.year + Math.ceil(maxDays / 365) + 1) return runs;
        continue;
      }
      const dow = new Date(Date.UTC(y2, m2 - 1, d2)).getUTCDay();
      if (!matchesDay(fields, y2, m2, d2, dow)) {
        d2 += 1;
        continue;
      }
      // This date fires: enumerate hours/minutes/seconds after `after`.
      let foundAny = false;
      for (const h of fields.hours) {
        for (const mi of fields.minutes) {
          for (const s of fields.seconds) {
            const ts = localToUTC(y2, m2, d2, h, mi, s, timeZone);
            let check = localParts(ts, timeZone);
            if (
              check.year === y2 &&
              check.month === m2 &&
              check.day === d2 &&
              check.hour === h &&
              check.minute === mi
            ) {
              if (ts > after) {
                const label = fmt.format(new Date(ts)).replace(',24:', ',00:');
                runs.push({ utc: ts, label, iso: new Date(ts).toISOString() });
                foundAny = true;
                if (runs.length >= count) break;
              }
            }
          }
          if (runs.length >= count) break;
        }
        if (runs.length >= count) break;
      }
      if (!foundAny && dayOffset === 0) {
        // day matches but nothing later today; just move to next date
      }
      d2 += 1;
      if (y2 > cur.year + Math.ceil(maxDays / 365) + 1) return runs;
    }
    break; // inner while walks dates itself; outer loop only seeds the start
  }
  return runs;
}

function advanceLocalDay(
  year: number,
  month1: number,
  day: number
): { year: number; month: number; day: number } {
  let m = month1;
  let y = year;
  if (day < daysInMonth(y, m)) return { year: y, month: m, day: day + 1 };
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return { year: y, month: m, day: 1 };
}

/** Count of fire times per (day,hour) cell for a heatmap over the next `days` days. */
export interface HeatmapCell {
  day: string; // yyyy-mm-dd local
  hour: number;
  count: number;
}

export function computeHeatmap(
  fields: CronFields,
  timeZone: string,
  after: number,
  days = 7
): { cells: HeatmapCell[]; dayLabels: string[] } {
  const cells: HeatmapCell[] = [];
  const dayLabels: string[] = [];
  const start = localParts(after, timeZone);
  let y = start.year;
  let m = start.month;
  let d = start.day;
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  for (let i = 0; i < days; i++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dayLabels.push(dayFmt.format(localToUTC(y, m, d, 12, 0, 0, timeZone)));
    for (let h = 0; h < 24; h++) {
      let count = 0;
      if (fields.months.includes(m) && matchesDay(fields, y, m, d, dow)) {
        for (const mi of fields.minutes) {
          for (const s of fields.seconds) {
            const ts = localToUTC(y, m, d, h, mi, s, timeZone);
            const p = localParts(ts, timeZone);
            if (p.year === y && p.month === m && p.day === d && p.hour === h) count++;
          }
        }
      }
      cells.push({ day: dateKey, hour: h, count });
    }
    ({ year: y, month: m, day: d } = advanceLocalDay(y, m, d));
  }
  return { cells, dayLabels };
}

/** Which field does a 5/6-part expression map onto when toggling day field mode? */
export function applyDayFieldMode(
  expression: string,
  mode: 'dom' | 'dow'
): { expression: string; error?: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) {
    return { expression, error: 'Cannot toggle day field: expression must have 5 or 6 fields.' };
  }
  if (mode === 'dom') {
    // restrict day-of-month, wildcard day-of-week
    parts[parts.length - 1] = '*';
  } else {
    // restrict day-of-week, wildcard day-of-month
    parts[parts.length - 3] = '*';
  }
  return { expression: parts.join(' ') };
}

export interface Preset {
  name: string;
  expression: string;
  description: string;
}

export const PRESETS: Preset[] = [
  { name: 'Every minute', expression: '* * * * *', description: 'Fires every minute' },
  { name: 'Hourly', expression: '0 * * * *', description: 'At the top of every hour' },
  { name: 'Nightly at 2am', expression: '0 2 * * *', description: 'Every day at 02:00' },
  {
    name: 'Weekdays 9-5 every 15min',
    expression: '*/15 9-17 * * 1-5',
    description: 'Business hours, Mon-Fri',
  },
  { name: 'Every 5 minutes', expression: '*/5 * * * *', description: 'Five-minute cadence' },
  { name: 'Mondays at noon', expression: '0 12 * * 1', description: 'Monday 12:00' },
  { name: 'First of month', expression: '0 0 1 * *', description: 'Midnight on day 1' },
  { name: 'Leap day', expression: '0 0 29 2 *', description: 'Feb 29 — leap years only' },
];
