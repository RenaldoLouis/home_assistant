import { dayKey, monthKey, parseMonth } from '../src/expenses/dates';
import {
  buildMonthRecap,
  summarizeMonthRecap,
} from '../src/expenses/monthRecap';

const at = (month: number, day: number, hour = 12, minute = 0) =>
  new Date(2026, month, day, hour, minute).toISOString();

// 6 October 2026 is a Tuesday; 1 October 2026 is a Thursday.
const OCT_6 = new Date(2026, 9, 6, 14);

describe('buildMonthRecap', () => {
  it('totals the month so far, keeping income and other months out of spending', () => {
    const recap = buildMonthRecap(
      [
        { amount: 50000, date: at(9, 1) },
        { amount: 200000, date: at(9, 4) },
        {
          amount: 30000,
          createdAt: { seconds: new Date(2026, 9, 6, 8).getTime() / 1000 },
        },
        { amount: 100000, type: 'income', date: at(9, 6) },
        { amount: 999000, date: at(8, 30, 23, 59) },
        { amount: 77000, date: at(9, 7) },
      ],
      new Date(2026, 9, 15),
      OCT_6,
    );

    expect(recap.total).toBe(280000);
    expect(recap.incomeTotal).toBe(100000);
    expect(recap.netSpend).toBe(180000);
    expect(recap.expenseCount).toBe(3);
    expect(recap.daysInMonth).toBe(31);
    expect(recap.daysElapsed).toBe(6);
    expect(recap.isComplete).toBe(false);
    expect(recap.dailyAverage).toBe(46667);
    expect(recap.days).toHaveLength(31);
    expect(recap.days[3].total).toBe(200000);
    expect(dayKey(recap.monthStart)).toBe('2026-10-01');
  });

  it('compares the month so far with the same days of the previous month', () => {
    const recap = buildMonthRecap(
      [
        { amount: 100000, date: at(8, 3) },
        { amount: 50000, date: at(8, 6, 23, 59) },
        { amount: 400000, date: at(8, 7, 0, 0) },
        { amount: 120000, date: at(9, 2) },
        { amount: 60000, date: at(9, 5) },
      ],
      OCT_6,
      OCT_6,
    );

    expect(recap.total).toBe(180000);
    expect(recap.comparison.previousPeriodDays).toBe(6);
    expect(recap.comparison.previousPeriodTotal).toBe(150000);
    expect(recap.comparison.previousMonthTotal).toBe(550000);
    expect(recap.comparison.change).toBe(30000);
    expect(recap.comparison.changeRatio).toBeCloseTo(0.2);
    expect(dayKey(recap.comparison.previousMonthStart)).toBe('2026-09-01');
  });

  it('clamps the comparison window to a shorter previous month', () => {
    const recap = buildMonthRecap(
      [
        { amount: 80000, date: at(1, 28, 23, 0) },
        { amount: 20000, date: at(2, 1, 0, 0) },
      ],
      new Date(2026, 2, 1),
      new Date(2026, 2, 30, 9),
    );

    expect(recap.daysElapsed).toBe(30);
    expect(recap.comparison.previousPeriodDays).toBe(28);
    expect(recap.comparison.previousPeriodTotal).toBe(80000);
    expect(recap.comparison.changeRatio).toBeCloseTo(-0.75);
  });

  it('compares a completed past month with the whole previous month', () => {
    const recap = buildMonthRecap(
      [
        { amount: 40000, date: at(7, 31) },
        { amount: 60000, date: at(8, 30) },
      ],
      new Date(2026, 8, 1),
      OCT_6,
    );

    expect(recap.isComplete).toBe(true);
    expect(recap.daysElapsed).toBe(30);
    expect(recap.comparison.previousPeriodDays).toBe(31);
    expect(recap.comparison.previousPeriodTotal).toBe(40000);
    expect(recap.comparison.previousMonthTotal).toBe(40000);
  });

  it('finds the highest day and the highest Monday–Sunday week, clipped to the month', () => {
    const recap = buildMonthRecap(
      [
        { amount: 300000, date: at(9, 2) },
        { amount: 50000, date: at(9, 4) },
        { amount: 100000, date: at(9, 6) },
        { amount: 100000, date: at(9, 7) },
        { amount: 100000, date: at(9, 8) },
        { amount: 100000, date: at(9, 9) },
        { amount: 120000, date: at(9, 15) },
        { amount: 10000, date: at(9, 20) },
      ],
      OCT_6,
      new Date(2026, 9, 20, 18),
    );

    expect(
      recap.weeks.map(week => [
        dayKey(week.start),
        dayKey(week.end),
        week.total,
      ]),
    ).toEqual([
      ['2026-10-01', '2026-10-04', 350000],
      ['2026-10-05', '2026-10-11', 400000],
      ['2026-10-12', '2026-10-18', 120000],
      ['2026-10-19', '2026-10-20', 10000],
    ]);
    expect(recap.weeks.reduce((sum, week) => sum + week.total, 0)).toBe(
      recap.total,
    );
    expect(dayKey(recap.peakDay!.date)).toBe('2026-10-02');
    expect(recap.peakDay!.total).toBe(300000);
    expect(dayKey(recap.peakWeek!.start)).toBe('2026-10-05');
    expect(recap.peakWeek!.total).toBe(400000);
  });

  it('resolves ties to the earliest day and week', () => {
    const recap = buildMonthRecap(
      [
        { amount: 50000, date: at(9, 2) },
        { amount: 50000, date: at(9, 5) },
      ],
      OCT_6,
      OCT_6,
    );

    expect(dayKey(recap.peakDay!.date)).toBe('2026-10-02');
    expect(dayKey(recap.peakWeek!.start)).toBe('2026-10-01');
  });

  it('has no peaks or change ratio when nothing was spent', () => {
    const recap = buildMonthRecap(
      [{ amount: 500000, type: 'income', date: at(9, 3) }],
      OCT_6,
      OCT_6,
    );

    expect(recap.total).toBe(0);
    expect(recap.peakDay).toBeNull();
    expect(recap.peakWeek).toBeNull();
    expect(recap.categories).toEqual([]);
    expect(recap.comparison.changeRatio).toBeNull();
  });

  it('treats a month that has not started yet as empty', () => {
    const recap = buildMonthRecap(
      [{ amount: 10000, date: at(10, 2) }],
      new Date(2026, 10, 1),
      OCT_6,
    );

    expect(recap.daysElapsed).toBe(0);
    expect(recap.total).toBe(0);
    expect(recap.weeks).toEqual([]);
    expect(recap.dailyAverage).toBe(0);
    expect(recap.comparison.previousPeriodTotal).toBe(0);
  });

  it('ranks spending categories by total with their share of the month', () => {
    const recap = buildMonthRecap(
      [
        { amount: 100000, category: 'Food', date: at(9, 1) },
        { amount: 50000, category: ' Food ', date: at(9, 2) },
        { amount: 50000, category: 'Transport', date: at(9, 3) },
        { amount: 50000, date: at(9, 4) },
        { amount: 900000, category: 'Income', type: 'income', date: at(9, 5) },
      ],
      OCT_6,
      OCT_6,
    );

    expect(recap.categories).toEqual([
      { category: 'Food', total: 150000, share: 0.6 },
      { category: 'Transport', total: 50000, share: 0.2 },
      { category: 'Uncategorized', total: 50000, share: 0.2 },
    ]);
  });
});

describe('summarizeMonthRecap', () => {
  it('produces a plain, date-keyed summary Jarvis can speak from', () => {
    const recap = buildMonthRecap(
      [
        { amount: 100000, date: at(8, 2) },
        { amount: 300000, category: 'Food', date: at(9, 2) },
        { amount: 50000, category: 'Transport', date: at(9, 5) },
        { amount: 20000, type: 'income', date: at(9, 5) },
      ],
      OCT_6,
      OCT_6,
    );

    expect(summarizeMonthRecap(recap)).toEqual({
      month: '2026-10',
      currency: 'IDR',
      isComplete: false,
      daysElapsed: 6,
      daysInMonth: 31,
      totalSpent: 350000,
      incomeReceived: 20000,
      netSpend: 330000,
      expenseCount: 2,
      dailyAverage: 58333,
      comparison: {
        comparedWith: '2026-09-01 to 2026-09-06',
        previousTotal: 100000,
        previousFullMonthTotal: 100000,
        change: 250000,
        changePercent: 250,
      },
      highestDay: { date: '2026-10-02', total: 300000 },
      highestWeek: { from: '2026-10-01', to: '2026-10-04', total: 300000 },
      weeks: [
        { from: '2026-10-01', to: '2026-10-04', total: 300000 },
        { from: '2026-10-05', to: '2026-10-06', total: 50000 },
      ],
      topCategories: [
        { category: 'Food', total: 300000, sharePercent: 86 },
        { category: 'Transport', total: 50000, sharePercent: 14 },
      ],
    });
  });
});

describe('month keys', () => {
  it('formats and parses YYYY-MM month keys in local time', () => {
    expect(monthKey(new Date(2026, 9, 6))).toBe('2026-10');
    expect(dayKey(parseMonth('2026-02')!)).toBe('2026-02-01');
  });

  it('rejects malformed month keys', () => {
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('2026-1')).toBeNull();
    expect(parseMonth('October')).toBeNull();
  });
});
