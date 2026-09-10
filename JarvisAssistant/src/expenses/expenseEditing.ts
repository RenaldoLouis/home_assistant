import { EditableExpense, ExpenseEdit } from './types';
import { normalizeDate } from './dates';

export function buildExpenseUpdate(
  expense: EditableExpense,
  edit: ExpenseEdit,
) {
  if (!Number.isSafeInteger(edit.amount) || edit.amount <= 0) {
    throw new Error('Enter a whole rupiah amount greater than zero.');
  }
  const category = edit.category.trim();
  if (!category || category.length > 60)
    throw new Error('Use a category between 1 and 60 characters.');
  const date = normalizeDate(edit.date);
  if (!date) throw new Error('Choose a valid expense date.');
  return {
    amount: edit.amount,
    category,
    date: date.toISOString(),
    originalAmount: expense.originalAmount ?? expense.amount,
    originalCategory: expense.originalCategory ?? expense.category,
  };
}
