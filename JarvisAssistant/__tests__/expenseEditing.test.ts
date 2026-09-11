import { buildExpenseUpdate } from '../src/expenses/expenseEditing';

const expense = {
  id: 'one',
  amount: 25000,
  category: 'Food',
  merchant: 'Cafe',
  bank: 'BCA',
  date: '2026-09-10T05:00:00.000Z',
};

test('corrects the existing expense while preserving the captured amount and category', () => {
  expect(
    buildExpenseUpdate(expense, {
      amount: 18000,
      category: ' Dating ',
      date: expense.date,
    }),
  ).toEqual({
    amount: 18000,
    category: 'Dating',
    date: expense.date,
    type: 'expense',
    originalAmount: 25000,
    originalCategory: 'Food',
  });
  expect(
    buildExpenseUpdate(
      {
        ...expense,
        amount: 18000,
        originalAmount: 25000,
        originalCategory: 'Food',
      },
      { amount: 19000, category: 'Travel', date: expense.date },
    ),
  ).toMatchObject({ originalAmount: 25000, originalCategory: 'Food' });
  expect(
    buildExpenseUpdate(
      {
        ...expense,
        type: 'income',
      },
      { amount: 30000, category: 'Income', date: expense.date },
    ),
  ).toMatchObject({ type: 'income' });
});

test.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid rupiah amount %s',
  amount => {
    expect(() =>
      buildExpenseUpdate(expense, {
        amount,
        category: 'Food',
        date: expense.date,
      }),
    ).toThrow();
  },
);
