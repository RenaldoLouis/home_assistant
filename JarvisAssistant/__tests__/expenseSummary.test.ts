import {
  buildExpenseSummary,
  buildDayReport,
} from '../src/expenses/expenseSummary';

describe('expense summary', () => {
  it('selects a local calendar day, excluding the next midnight and retaining legacy timestamps', () => {
    const report = buildDayReport(
      [
        {
          id: 'late',
          amount: 25000,
          date: new Date(2026, 8, 10, 23, 59).toISOString(),
        },
        {
          id: 'next',
          amount: 99000,
          date: new Date(2026, 8, 11).toISOString(),
        },
        {
          id: 'legacy',
          amount: 10000,
          createdAt: { seconds: new Date(2026, 8, 10, 8).getTime() / 1000 },
        },
      ],
      new Date(2026, 8, 10, 12),
    );
    expect(report.total).toBe(35000);
    expect(report.expenses.map(expense => expense.id)).toEqual([
      'late',
      'legacy',
    ]);
    expect(report.week.map(day => day.total)).toEqual([
      0, 0, 0, 35000, 99000, 0, 0,
    ]);
  });
  it('builds today, week, month, and chart totals from saved expenses', () => {
    const summary = buildExpenseSummary(
      [
        { amount: 250580, date: new Date(2026, 8, 5, 9).toISOString() },
        { amount: 42500, date: new Date(2026, 8, 3, 9).toISOString() },
        { amount: 10000, date: new Date(2026, 7, 20, 9).toISOString() },
        { amount: 999999, date: new Date(2026, 6, 20, 9).toISOString() },
      ],
      new Date(2026, 8, 5, 19),
    );

    expect(summary.today).toBe(250580);
    expect(summary.lastWeek).toBe(293080);
    expect(summary.lastMonth).toBe(303080);
    expect(summary.chartData.datasets[0].data).toEqual([
      0, 0, 0, 42500, 0, 250580, 0,
    ]);
  });
});

it('keeps an entire local day through daylight-saving transitions', () => {
  const report = buildDayReport(
    [
      { amount: 10000, date: new Date(2026, 2, 8, 23, 30).toISOString() },
      { amount: 90000, date: new Date(2026, 2, 9, 0, 0).toISOString() },
    ],
    new Date(2026, 2, 8),
  );
  expect(report.total).toBe(10000);
});
