/** Calendar boundaries always follow the phone's current timezone. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return dayKey(date) === value ? date : null;
}

export function normalizeDate(value: unknown): Date | null {
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    try {
      date = value.toDate();
    } catch {
      return null;
    }
  } else if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    const nanos =
      'nanoseconds' in value && typeof value.nanoseconds === 'number'
        ? value.nanoseconds
        : 0;
    date = new Date(value.seconds * 1000 + nanos / 1000000);
  } else {
    return null;
  }
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}
