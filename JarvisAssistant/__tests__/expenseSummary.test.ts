import { buildExpenseSummary } from '../src/expenses/expenseSummary';

describe('expense summary', () => {
  it('builds today, week, month, and chart totals from saved expenses', () => {
    const summary = buildExpenseSummary(
      [
        { amount: 250580, date: '2026-09-05T02:00:00.000Z' },
        { amount: 42500, date: '2026-09-03T02:00:00.000Z' },
        { amount: 10000, date: '2026-08-20T02:00:00.000Z' },
        { amount: 999999, date: '2026-07-20T02:00:00.000Z' },
      ],
      new Date('2026-09-05T12:00:00.000Z'),
    );

    expect(summary.today).toBe(250580);
    expect(summary.lastWeek).toBe(293080);
    expect(summary.lastMonth).toBe(303080);
    expect(summary.chartData.datasets[0].data).toEqual([
      0, 0, 0, 42500, 0, 250580, 0,
    ]);
  });
});
