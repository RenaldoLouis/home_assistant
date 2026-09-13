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

  it('separates income from spending so income does not inflate spending total', () => {
    const report = buildDayReport(
      [
        {
          id: 'food',
          amount: 376000,
          type: 'expense',
          date: new Date(2026, 8, 10, 12, 12).toISOString(),
        },
        {
          id: 'transfer-1',
          amount: 68000,
          type: 'income',
          date: new Date(2026, 8, 10, 12, 40).toISOString(),
        },
        {
          id: 'transfer-2',
          amount: 106000,
          type: 'income',
          date: new Date(2026, 8, 10, 12, 21).toISOString(),
        },
      ],
      new Date(2026, 8, 10),
    );

    expect(report.total).toBe(376000);
    expect(report.incomeTotal).toBe(174000);
    expect(report.netSpend).toBe(202000); // 376000 spend - 174000 earn
    expect(report.expenseCount).toBe(1);
    expect(report.incomeCount).toBe(2);
    expect(report.expenses.map(e => e.id)).toEqual([
      'transfer-1',
      'transfer-2',
      'food',
    ]);
  });

  it('calculates weekly actual spend (weekNetSpend and weekIncomeTotal) including days where income exceeds expenses', () => {
    const report = buildDayReport(
      [
        {
          id: 'mon-spend',
          amount: 50000,
          type: 'expense',
          date: new Date(2026, 8, 7, 10).toISOString(),
        },
        {
          id: 'tue-earn',
          amount: 200000,
          type: 'income',
          date: new Date(2026, 8, 8, 10).toISOString(),
        },
        {
          id: 'wed-spend',
          amount: 80000,
          type: 'expense',
          date: new Date(2026, 8, 9, 10).toISOString(),
        },
        {
          id: 'wed-earn',
          amount: 30000,
          type: 'income',
          date: new Date(2026, 8, 9, 15).toISOString(),
        },
      ],
      new Date(2026, 8, 8, 12),
    );

    // Tuesday alone: 0 spend - 200000 earn = -200000
    expect(report.total).toBe(0);
    expect(report.incomeTotal).toBe(200000);
    expect(report.netSpend).toBe(-200000);

    // Week recap:
    // Total expenses: 50000 + 80000 = 130000
    // Total income: 200000 + 30000 = 230000
    // Week actual spend: 130000 - 230000 = -100000
    expect(report.weekTotal).toBe(130000);
    expect(report.weekIncomeTotal).toBe(230000);
    expect(report.weekNetSpend).toBe(-100000);

    // Per day in week:
    // Mon: total 50000, income 0, netSpend 50000
    // Tue: total 0, income 200000, netSpend -200000
    // Wed: total 80000, income 30000, netSpend 50000
    const mon = report.week[0];
    const tue = report.week[1];
    const wed = report.week[2];
    expect(mon.total).toBe(50000);
    expect(mon.income).toBe(0);
    expect(mon.netSpend).toBe(50000);

    expect(tue.total).toBe(0);
    expect(tue.income).toBe(200000);
    expect(tue.netSpend).toBe(-200000);

    expect(wed.total).toBe(80000);
    expect(wed.income).toBe(30000);
    expect(wed.netSpend).toBe(50000);
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
