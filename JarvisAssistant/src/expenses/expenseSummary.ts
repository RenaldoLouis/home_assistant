export interface SavedExpense {
  amount?: unknown;
  date?: unknown;
  createdAt?: unknown;
}

export interface ExpenseSummary {
  today: number;
  lastWeek: number;
  lastMonth: number;
  chartData: {
    labels: string[];
    datasets: { data: number[] }[];
  };
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildExpenseSummary(
  expenses: SavedExpense[],
  now: Date = new Date(),
): ExpenseSummary {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = startOfWeek(todayStart);
  const monthStart = addDays(todayStart, -30);
  const weeklyTotals = new Array(WEEK_LABELS.length).fill(0);

  let today = 0;
  let lastWeek = 0;
  let lastMonth = 0;

  for (const expense of expenses) {
    const amount = normalizeAmount(expense.amount);
    const date = normalizeExpenseDate(expense.date) ?? normalizeExpenseDate(expense.createdAt);

    if (amount <= 0 || !date) {
      continue;
    }

    if (date >= todayStart && date < tomorrowStart) {
      today += amount;
    }

    if (date >= weekStart && date < addDays(weekStart, WEEK_LABELS.length)) {
      lastWeek += amount;
      weeklyTotals[getMondayFirstDayIndex(date)] += amount;
    }

    if (date >= monthStart && date < tomorrowStart) {
      lastMonth += amount;
    }
  }

  return {
    today,
    lastWeek,
    lastMonth,
    chartData: {
      labels: WEEK_LABELS,
      datasets: [{ data: weeklyTotals }],
    },
  };
}

function normalizeAmount(amount: unknown): number {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return Math.round(amount);
  }

  if (typeof amount === 'string') {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
}

function normalizeExpenseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && isValidDate(date) ? date : null;
  }

  if (
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    const date = new Date(value.seconds * 1000);
    return isValidDate(date) ? date : null;
  }

  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const mondayFirstDay = getMondayFirstDayIndex(date);
  return addDays(startOfDay(date), -mondayFirstDay);
}

function getMondayFirstDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}
