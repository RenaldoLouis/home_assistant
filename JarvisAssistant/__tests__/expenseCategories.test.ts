import {
  DEFAULT_EXPENSE_CATEGORIES,
  buildExpenseCategoryOptions,
} from '../src/expenses/categories';

describe('expense categories', () => {
  it('keeps Dating as a default editable category', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toEqual(['Dating']);
  });

  it('combines saved categories with defaults and a fallback option', () => {
    expect(buildExpenseCategoryOptions(['Food & Beverage', 'Dating', ''])).toEqual([
      'Dating',
      'Food & Beverage',
      'Uncategorized',
    ]);
  });
});
