import { UNCATEGORIZED_EXPENSE_CATEGORY } from './categories';
import { TransactionType } from './types';

const TRANSACTION_TYPES: readonly TransactionType[] = [
  'expense',
  'income',
  'investment',
];

/** Categories that always travel with their type, in both directions. */
const PAIRED_CATEGORIES: Partial<Record<TransactionType, string>> = {
  income: 'Income',
  investment: 'Investment',
};

export interface Classification {
  category: string;
  type: TransactionType;
}

export function parseTransactionType(value: unknown): TransactionType | null {
  if (typeof value !== 'string') return null;
  const type = value.trim().toLowerCase();
  return TRANSACTION_TYPES.find(known => known === type) ?? null;
}

/** Stored records without a known type count as spending. */
export function transactionTypeOf(record: { type?: unknown }): TransactionType {
  return parseTransactionType(record.type) ?? 'expense';
}

/** The type a category implies: Income → income, Investment → investment. */
export function pairedType(category: string): TransactionType | null {
  const name = category.trim().toLowerCase();
  const match = Object.entries(PAIRED_CATEGORIES).find(
    ([, paired]) => paired.toLowerCase() === name,
  );
  return match ? (match[0] as TransactionType) : null;
}

/**
 * Applies a category or type change the same way in the editor and for
 * Jarvis. Picking a paired category sets its type and leaving one returns to
 * expense. Switching type swaps a paired or uncategorized category for the new
 * type's own, and keeps any other category the user chose.
 */
export function reclassify(
  current: Classification,
  change: { category?: string; type?: TransactionType },
): Classification {
  if (change.type) {
    const category = change.category ?? current.category;
    const paired = PAIRED_CATEGORIES[change.type];
    const impliedType = pairedType(category);
    if (impliedType && impliedType !== change.type) {
      return {
        category: paired ?? UNCATEGORIZED_EXPENSE_CATEGORY,
        type: change.type,
      };
    }
    if (paired && category === UNCATEGORIZED_EXPENSE_CATEGORY) {
      return { category: paired, type: change.type };
    }
    return { category, type: change.type };
  }
  if (change.category !== undefined) {
    return {
      category: change.category,
      type: pairedType(change.category) ?? 'expense',
    };
  }
  return current;
}
