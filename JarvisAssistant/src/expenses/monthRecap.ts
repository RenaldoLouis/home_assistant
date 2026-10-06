import { normalizeExpenseCategory } from './categories';
import {
  addMonths,
  dayKey,
  daysInMonth,
  monthKey,
  normalizeDate,
  startOfMonth,
} from './dates';
import { SavedExpense, normalizeAmount } from './expenseSummary';

export interface RecapDay {
  date: Date;
  total: number;
}

/** A Monday–Sunday week clipped to the month (and to today while in progress). */
export interface RecapWeek {
  start: Date;
  /** Last day included in the week, inclusive. */
  end: Date;
  total: number;
}

export interface RecapCategory {
  category: string;
  total: number;
  /** Fraction (0–1) of the month's spending. */
  share: number;
}

export interface MonthComparison {
  previousMonthStart: Date;
  /** The previous month is compared over days 1…previousPeriodDays only. */
  previousPeriodDays: number;
  previousPeriodTotal: number;
  previousMonthTotal: number;
  change: number;
  /** null when the previous period had no spending to compare against. */
  changeRatio: number | null;
}

export interface MonthRecap {
  monthStart: Date;
  daysInMonth: number;
  /** Days of the month up to and including today (0 for a future month). */
  daysElapsed: number;
  isComplete: boolean;
  total: number;
  incomeTotal: number;
  netSpend: number;
  expenseCount: number;
  dailyAverage: number;
  /** Every day of the month; days after today stay at zero. */
  days: RecapDay[];
  weeks: RecapWeek[];
  peakDay: RecapDay | null;
  peakWeek: RecapWeek | null;
  categories: RecapCategory[];
  comparison: MonthComparison;
}

/**
 * Recaps spending for the calendar month containing `month`, in the phone's
 * timezone. Totals are gross spending; income is reported separately. While
 * the month is in progress it is compared with the same days of the previous
 * month so early-month totals are not measured against a full month.
 */
export function buildMonthRecap(
  expenses: SavedExpense[],
  month: Date,
  now: Date = new Date(),
): MonthRecap {
  const monthStart = startOfMonth(month);
  const monthLength = daysInMonth(monthStart);
  const monthsAgo = monthIndex(now) - monthIndex(monthStart);
  const daysElapsed =
    monthsAgo > 0 ? monthLength : monthsAgo === 0 ? now.getDate() : 0;
  const isComplete = daysElapsed === monthLength;
  const periodEnd = dayOfMonth(monthStart, daysElapsed + 1);

  const previousMonthStart = addMonths(monthStart, -1);
  const previousMonthLength = daysInMonth(previousMonthStart);
  const previousPeriodDays = isComplete
    ? previousMonthLength
    : Math.min(daysElapsed, previousMonthLength);
  const previousPeriodEnd = dayOfMonth(
    previousMonthStart,
    previousPeriodDays + 1,
  );

  const days: RecapDay[] = Array.from({ length: monthLength }, (_, index) => ({
    date: dayOfMonth(monthStart, index + 1),
    total: 0,
  }));
  const categoryTotals = new Map<string, number>();
  let total = 0;
  let incomeTotal = 0;
  let expenseCount = 0;
  let previousPeriodTotal = 0;
  let previousMonthTotal = 0;

  for (const expense of expenses) {
    const amount = normalizeAmount(expense.amount);
    const date =
      normalizeDate(expense.date) ?? normalizeDate(expense.createdAt);
    if (amount <= 0 || !date) continue;

    const isIncome = expense.type === 'income';
    if (date >= monthStart && date < periodEnd) {
      if (isIncome) {
        incomeTotal += amount;
      } else {
        total += amount;
        expenseCount += 1;
        days[date.getDate() - 1].total += amount;
        const category = normalizeExpenseCategory(expense.category);
        categoryTotals.set(
          category,
          (categoryTotals.get(category) ?? 0) + amount,
        );
      }
    } else if (!isIncome && date >= previousMonthStart && date < monthStart) {
      previousMonthTotal += amount;
      if (date < previousPeriodEnd) previousPeriodTotal += amount;
    }
  }

  const weeks = groupIntoWeeks(days.slice(0, daysElapsed));

  return {
    monthStart,
    daysInMonth: monthLength,
    daysElapsed,
    isComplete,
    total,
    incomeTotal,
    netSpend: total - incomeTotal,
    expenseCount,
    dailyAverage: daysElapsed > 0 ? Math.round(total / daysElapsed) : 0,
    days,
    weeks,
    peakDay: highest(days),
    peakWeek: highest(weeks),
    categories: Array.from(categoryTotals, ([category, categoryTotal]) => ({
      category,
      total: categoryTotal,
      share: categoryTotal / total,
    })).sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category),
    ),
    comparison: {
      previousMonthStart,
      previousPeriodDays,
      previousPeriodTotal,
      previousMonthTotal,
      change: total - previousPeriodTotal,
      changeRatio:
        previousPeriodTotal > 0
          ? (total - previousPeriodTotal) / previousPeriodTotal
          : null,
    },
  };
}

export const TOP_CATEGORY_COUNT = 5;

/**
 * Plain, date-keyed version of a recap for Jarvis tool responses. Only
 * aggregates leave the device — no merchants, banks, notes, or expense IDs.
 */
export function summarizeMonthRecap(recap: MonthRecap) {
  const { comparison } = recap;
  const toRange = (week: RecapWeek) => ({
    from: dayKey(week.start),
    to: dayKey(week.end),
    total: week.total,
  });
  return {
    month: monthKey(recap.monthStart),
    currency: 'IDR',
    isComplete: recap.isComplete,
    daysElapsed: recap.daysElapsed,
    daysInMonth: recap.daysInMonth,
    totalSpent: recap.total,
    incomeReceived: recap.incomeTotal,
    netSpend: recap.netSpend,
    expenseCount: recap.expenseCount,
    dailyAverage: recap.dailyAverage,
    comparison: {
      comparedWith:
        comparison.previousPeriodDays > 0
          ? `${dayKey(comparison.previousMonthStart)} to ${dayKey(
              dayOfMonth(
                comparison.previousMonthStart,
                comparison.previousPeriodDays,
              ),
            )}`
          : null,
      previousTotal: comparison.previousPeriodTotal,
      previousFullMonthTotal: comparison.previousMonthTotal,
      change: comparison.change,
      changePercent:
        comparison.changeRatio === null
          ? null
          : Math.round(comparison.changeRatio * 100),
    },
    highestDay: recap.peakDay
      ? { date: dayKey(recap.peakDay.date), total: recap.peakDay.total }
      : null,
    highestWeek: recap.peakWeek ? toRange(recap.peakWeek) : null,
    weeks: recap.weeks.map(toRange),
    topCategories: recap.categories
      .slice(0, TOP_CATEGORY_COUNT)
      .map(({ category, total, share }) => ({
        category,
        total,
        sharePercent: Math.round(share * 100),
      })),
  };
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function dayOfMonth(monthStart: Date, day: number): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
}

function groupIntoWeeks(days: RecapDay[]): RecapWeek[] {
  const weeks: RecapWeek[] = [];
  for (const day of days) {
    const current = weeks[weeks.length - 1];
    if (!current || day.date.getDay() === 1) {
      weeks.push({ start: day.date, end: day.date, total: day.total });
    } else {
      current.end = day.date;
      current.total += day.total;
    }
  }
  return weeks;
}

/** First entry with the largest positive total, so ties go to the earliest. */
function highest<T extends { total: number }>(items: T[]): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.total > (best?.total ?? 0)) best = item;
  }
  return best;
}
