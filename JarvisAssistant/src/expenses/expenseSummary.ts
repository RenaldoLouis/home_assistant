import { addDays, normalizeDate, startOfDay } from './dates';
export interface SavedExpense {
  amount?: unknown;
  date?: unknown;
  createdAt?: unknown;
  type?: unknown;
  note?: unknown;
}

export interface DayWeekItem {
  label: string;
  date: Date;
  total: number;
  income: number;
  netSpend: number;
}

export interface DayReport<T = SavedExpense> {
  total: number;
  incomeTotal: number;
  netSpend: number;
  expenseCount: number;
  incomeCount: number;
  expenses: T[];
  week: DayWeekItem[];
  weekTotal: number;
  weekIncomeTotal: number;
  weekNetSpend: number;
}

export interface ExpenseSummary {
  today: number;
  todayIncome: number;
  lastWeek: number;
  lastMonth: number;
  chartData: {
    labels: string[];
    datasets: { data: number[] }[];
  };
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildExpenseSummary(
  expenses: SavedExpense[],
  now: Date = new Date(),
): ExpenseSummary {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = startOfWeek(todayStart);
  const monthStart = addDays(todayStart, -29);
  const weeklyTotals = new Array(WEEK_LABELS.length).fill(0);

  let today = 0;
  let todayIncome = 0;
  let lastWeek = 0;
  let lastMonth = 0;

  for (const expense of expenses) {
    const amount = normalizeAmount(expense.amount);
    const date =
      normalizeDate(expense.date) ?? normalizeDate(expense.createdAt);

    if (amount <= 0 || !date) {
      continue;
    }

    const isIncome = expense.type === 'income';

    if (date >= todayStart && date < tomorrowStart) {
      if (isIncome) {
        todayIncome += amount;
      } else {
        today += amount;
      }
    }

    if (!isIncome) {
      if (date >= weekStart && date < addDays(weekStart, WEEK_LABELS.length)) {
        lastWeek += amount;
        weeklyTotals[getMondayFirstDayIndex(date)] += amount;
      }

      if (date >= monthStart && date < tomorrowStart) {
        lastMonth += amount;
      }
    }
  }

  return {
    today,
    todayIncome,
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

function startOfWeek(date: Date): Date {
  const mondayFirstDay = getMondayFirstDayIndex(date);
  return addDays(startOfDay(date), -mondayFirstDay);
}

function getMondayFirstDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildDayReport<T extends SavedExpense>(
  expenses: T[],
  selectedDate: Date,
): DayReport<T> {
  const start = startOfDay(selectedDate);
  const end = addDays(start, 1);
  const weekStart = startOfWeek(start);
  const week: DayWeekItem[] = WEEK_LABELS.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
    total: 0,
    income: 0,
    netSpend: 0,
  }));
  const dated = expenses
    .map(expense => ({
      expense,
      date: normalizeDate(expense.date) ?? normalizeDate(expense.createdAt),
      amount: normalizeAmount(expense.amount),
      isIncome: expense.type === 'income',
    }))
    .filter(entry => entry.date !== null && entry.amount > 0);

  for (const entry of dated) {
    const day = week.find(
      item => entry.date! >= item.date && entry.date! < addDays(item.date, 1),
    );
    if (day) {
      if (entry.isIncome) {
        day.income += entry.amount;
      } else {
        day.total += entry.amount;
      }
      day.netSpend = day.total - day.income;
    }
  }

  const selected = dated
    .filter(entry => entry.date! >= start && entry.date! < end)
    .sort((a, b) => b.date!.getTime() - a.date!.getTime());

  const expensesOnly = selected.filter(entry => !entry.isIncome);
  const incomeOnly = selected.filter(entry => entry.isIncome);

  const total = expensesOnly.reduce((sum, entry) => sum + entry.amount, 0);
  const incomeTotal = incomeOnly.reduce((sum, entry) => sum + entry.amount, 0);
  const weekTotal = week.reduce((sum, day) => sum + day.total, 0);
  const weekIncomeTotal = week.reduce((sum, day) => sum + day.income, 0);

  return {
    total,
    incomeTotal,
    netSpend: total - incomeTotal,
    expenseCount: expensesOnly.length,
    incomeCount: incomeOnly.length,
    expenses: selected.map(entry => entry.expense),
    week,
    weekTotal,
    weekIncomeTotal,
    weekNetSpend: weekTotal - weekIncomeTotal,
  };
}

