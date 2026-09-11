import {
  DEFAULT_EXPENSE_CATEGORIES,
  buildExpenseCategoryOptions,
} from '../src/expenses/categories';

describe('expense categories', () => {
  it('keeps Income and Dating as default editable categories', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toEqual(['Income', 'Dating']);
  });

  it('combines saved categories with defaults and a fallback option', () => {
    expect(buildExpenseCategoryOptions(['Food & Beverage', 'Dating', ''])).toEqual([
      'Income',
      'Dating',
      'Food & Beverage',
      'Uncategorized',
    ]);
  });
});
