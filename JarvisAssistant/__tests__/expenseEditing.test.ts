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
    note: '',
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

  // Switching category to Income on an expense automatically flips type to income
  expect(
    buildExpenseUpdate(expense, {
      amount: 100000,
      category: 'Income',
      date: expense.date,
    }),
  ).toMatchObject({ type: 'income', category: 'Income' });

  // Switching category away from Income automatically flips type to expense
  expect(
    buildExpenseUpdate(
      {
        ...expense,
        category: 'Income',
        type: 'income',
      },
      { amount: 100000, category: 'Food', date: expense.date },
    ),
  ).toMatchObject({ type: 'expense', category: 'Food' });

  // Explicit type override takes precedence
  expect(
    buildExpenseUpdate(expense, {
      amount: 50000,
      category: 'Refund',
      type: 'income',
      date: expense.date,
    }),
  ).toMatchObject({ type: 'income' });
});

test('handles custom expense note including trimming and preservation', () => {
  expect(
    buildExpenseUpdate(expense, {
      amount: 25000,
      category: 'Food',
      date: expense.date,
      note: '  Lunch with team  ',
    }),
  ).toMatchObject({
    note: 'Lunch with team',
  });

  // Preserves existing note when edit.note is undefined
  expect(
    buildExpenseUpdate(
      { ...expense, note: 'Existing note' },
      {
        amount: 25000,
        category: 'Food',
        date: expense.date,
      },
    ),
  ).toMatchObject({
    note: 'Existing note',
  });

  // Allows clearing note with empty string
  expect(
    buildExpenseUpdate(
      { ...expense, note: 'Existing note' },
      {
        amount: 25000,
        category: 'Food',
        date: expense.date,
        note: '   ',
      },
    ),
  ).toMatchObject({
    note: '',
  });
});

test('rejects notes exceeding 500 characters', () => {
  const longNote = 'a'.repeat(501);
  expect(() =>
    buildExpenseUpdate(expense, {
      amount: 25000,
      category: 'Food',
      date: expense.date,
      note: longNote,
    }),
  ).toThrow('Note must be 500 characters or fewer.');
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

