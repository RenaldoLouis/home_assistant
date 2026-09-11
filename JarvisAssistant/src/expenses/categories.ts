export const UNCATEGORIZED_EXPENSE_CATEGORY = 'Uncategorized';
export const DEFAULT_EXPENSE_CATEGORIES = ['Income', 'Dating'];

export function normalizeExpenseCategory(value: unknown): string {
  if (typeof value !== 'string') {
    return UNCATEGORIZED_EXPENSE_CATEGORY;
  }

  const category = value.trim();
  return category || UNCATEGORIZED_EXPENSE_CATEGORY;
}

export function buildExpenseCategoryOptions(savedCategories: unknown[]): string[] {
  const options = new Set<string>();

  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    options.add(normalizeExpenseCategory(category));
  }

  for (const category of savedCategories) {
    const normalized = normalizeExpenseCategory(category);

    if (normalized !== UNCATEGORIZED_EXPENSE_CATEGORY) {
      options.add(normalized);
    }
  }

  options.add(UNCATEGORIZED_EXPENSE_CATEGORY);

  return Array.from(options);
}
