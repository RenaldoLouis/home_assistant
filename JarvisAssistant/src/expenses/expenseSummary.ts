import { addDays, normalizeDate, startOfDay } from './dates';
import { transactionTypeOf } from './transactionTypes';
import { TransactionType } from './types';
export interface SavedExpense {
  amount?: unknown;
  date?: unknown;
  createdAt?: unknown;
  type?: unknown;
  note?: unknown;
  category?: unknown;
}

export interface DayWeekItem {
  label: string;
  date: Date;
  total: number;
  income: number;
  invested: number;
  netSpend: number;
}

export interface DayReport<T = SavedExpense> {
  total: number;
  incomeTotal: number;
  netSpend: number;
  expenseCount: number;
  incomeCount: number;
  investedTotal: number;
  investmentCount: number;
  expenses: T[];
  week: DayWeekItem[];
  weekTotal: number;
  weekIncomeTotal: number;
  weekInvestedTotal: number;
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

    const type = transactionTypeOf(expense);

    if (date >= todayStart && date < tomorrowStart) {
      if (type === 'income') {
        todayIncome += amount;
      } else if (type === 'expense') {
        today += amount;
      }
    }

    if (type === 'expense') {
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

export function normalizeAmount(amount: unknown): number {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return Math.round(amount);
  }

  if (typeof amount === 'string') {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
}

function sumOf<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
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
    invested: 0,
    netSpend: 0,
  }));
  const dated = expenses
    .map(expense => ({
      expense,
      date: normalizeDate(expense.date) ?? normalizeDate(expense.createdAt),
      amount: normalizeAmount(expense.amount),
      type: transactionTypeOf(expense),
    }))
    .filter(entry => entry.date !== null && entry.amount > 0);

  for (const entry of dated) {
    const day = week.find(
      item => entry.date! >= item.date && entry.date! < addDays(item.date, 1),
    );
    if (day) {
      if (entry.type === 'income') {
        day.income += entry.amount;
      } else if (entry.type === 'investment') {
        day.invested += entry.amount;
      } else {
        day.total += entry.amount;
      }
      day.netSpend = day.total - day.income;
    }
  }

  const selected = dated
    .filter(entry => entry.date! >= start && entry.date! < end)
    .sort((a, b) => b.date!.getTime() - a.date!.getTime());

  const ofType = (type: TransactionType) =>
    selected.filter(entry => entry.type === type);
  const expensesOnly = ofType('expense');
  const incomeOnly = ofType('income');
  const investmentsOnly = ofType('investment');

  const total = sumOf(expensesOnly, entry => entry.amount);
  const incomeTotal = sumOf(incomeOnly, entry => entry.amount);
  const weekTotal = sumOf(week, day => day.total);
  const weekIncomeTotal = sumOf(week, day => day.income);

  return {
    total,
    incomeTotal,
    netSpend: total - incomeTotal,
    expenseCount: expensesOnly.length,
    incomeCount: incomeOnly.length,
    investedTotal: sumOf(investmentsOnly, entry => entry.amount),
    investmentCount: investmentsOnly.length,
    expenses: selected.map(entry => entry.expense),
    week,
    weekTotal,
    weekIncomeTotal,
    weekInvestedTotal: sumOf(week, day => day.invested),
    weekNetSpend: weekTotal - weekIncomeTotal,
  };
}

