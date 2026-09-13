export type TransactionType = 'income' | 'expense';

export interface EditableExpense {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  bank: string;
  date: string;
  type?: TransactionType;
  note?: string;
  originalAmount?: number;
  originalCategory?: string;
}

export interface ExpenseEdit {
  amount: number;
  category: string;
  date: string;
  type?: TransactionType;
  note?: string;
}

