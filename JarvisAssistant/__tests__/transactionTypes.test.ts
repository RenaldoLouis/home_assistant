import {
  pairedType,
  parseTransactionType,
  reclassify,
} from '../src/expenses/transactionTypes';

describe('parseTransactionType', () => {
  it.each([
    ['expense', 'expense'],
    ['income', 'income'],
    ['investment', 'investment'],
    [' Investment ', 'investment'],
  ])('reads %p as %p', (value, expected) => {
    expect(parseTransactionType(value)).toBe(expected);
  });

  it.each([undefined, null, 42, '', 'savings', 'invest'])(
    'rejects %p',
    value => {
      expect(parseTransactionType(value)).toBeNull();
    },
  );
});

describe('pairedType', () => {
  it('pairs the Income and Investment categories with their types, ignoring case', () => {
    expect(pairedType('Income')).toBe('income');
    expect(pairedType(' investment ')).toBe('investment');
    expect(pairedType('Food')).toBeNull();
    expect(pairedType('Uncategorized')).toBeNull();
  });
});

describe('reclassify', () => {
  const food = { category: 'Food', type: 'expense' as const };

  it('picking a paired category sets its type', () => {
    expect(reclassify(food, { category: 'Investment' })).toEqual({
      category: 'Investment',
      type: 'investment',
    });
    expect(reclassify(food, { category: 'Income' })).toEqual({
      category: 'Income',
      type: 'income',
    });
  });

  it('leaving a paired category returns to expense', () => {
    expect(
      reclassify(
        { category: 'Investment', type: 'investment' },
        { category: 'Coffee' },
      ),
    ).toEqual({ category: 'Coffee', type: 'expense' });
  });

  it('switching type fills an uncategorized record with the paired category', () => {
    expect(
      reclassify(
        { category: 'Uncategorized', type: 'expense' },
        { type: 'investment' },
      ),
    ).toEqual({ category: 'Investment', type: 'investment' });
  });

  it('switching type swaps a paired category for the new type', () => {
    expect(
      reclassify(
        { category: 'Income', type: 'income' },
        { type: 'investment' },
      ),
    ).toEqual({ category: 'Investment', type: 'investment' });
    expect(
      reclassify(
        { category: 'Investment', type: 'investment' },
        { type: 'expense' },
      ),
    ).toEqual({ category: 'Uncategorized', type: 'expense' });
  });

  it('switching type keeps an ordinary category the user chose', () => {
    expect(reclassify(food, { type: 'investment' })).toEqual({
      category: 'Food',
      type: 'investment',
    });
  });

  it('an explicit type wins over a conflicting paired category', () => {
    expect(
      reclassify(food, { category: 'Income', type: 'investment' }),
    ).toEqual({ category: 'Investment', type: 'investment' });
  });
});
