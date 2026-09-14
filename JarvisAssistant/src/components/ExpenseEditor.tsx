import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { EditableExpense, ExpenseEdit, TransactionType } from '../expenses/types';
import { buildExpenseUpdate } from '../expenses/expenseEditing';
import { AnimatedPressable } from './AnimatedPressable';
import { Calendar } from './Calendar';
import { Sheet } from './Sheet';
import { Colors } from '../theme/colors';

export function ExpenseEditor({
  expense,
  categories,
  onSave,
  onDelete,
  onClose,
}: {
  expense: EditableExpense;
  categories: string[];
  onSave: (id: string, edit: ExpenseEdit) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const initialType: TransactionType =
    expense.type === 'income' ||
    expense.category.trim().toLowerCase() === 'income'
      ? 'income'
      : 'expense';
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(new Date(expense.date));
  const [note, setNote] = useState(expense.note || '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSelectCategory = (option: string) => {
    setCategory(option);
    if (option.trim().toLowerCase() === 'income') {
      setType('income');
    } else if (type === 'income') {
      setType('expense');
    }
  };

  const handleSelectType = (selectedType: TransactionType) => {
    setType(selectedType);
    if (selectedType === 'income') {
      if (
        category.trim().toLowerCase() !== 'income' &&
        category === 'Uncategorized'
      ) {
        setCategory('Income');
      }
    } else {
      if (category.trim().toLowerCase() === 'income') {
        setCategory('Uncategorized');
      }
    }
  };

  const save = async () => {
    if (inFlight.current) return;
    const effectiveType: TransactionType =
      type === 'income' || category.trim().toLowerCase() === 'income'
        ? 'income'
        : type;

    const edit: ExpenseEdit = {
      amount: /^\d+$/.test(amount.trim()) ? Number(amount) : NaN,
      category,
      date: date.toISOString(),
      type: effectiveType,
      note: note.trim(),
    };

    try {
      buildExpenseUpdate(expense, edit);
      inFlight.current = true;
      setSaving(true);
      setError('');
      await onSave(expense.id, edit);
      if (mounted.current) onClose();
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error && !('code' in err)
            ? err.message
            : 'Could not save this expense. Check your connection and try again.',
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || inFlight.current) return;
    try {
      inFlight.current = true;
      setDeleting(true);
      setError('');
      await onDelete(expense.id);
      if (mounted.current) onClose();
    } catch (err) {
      if (mounted.current) {
        setShowDeleteConfirm(false);
        setError(
          err instanceof Error && !('code' in err)
            ? err.message
            : 'Could not delete this expense. Check your connection and try again.',
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setDeleting(false);
    }
  };

  return (
    <Sheet title="Edit expense" onClose={onClose}>
      <Text style={styles.meta}>
        {expense.bank} · Changes update your spending totals.
      </Text>

      <Text style={styles.label}>Transaction type</Text>
      <View style={styles.typeSelector}>
        <AnimatedPressable
          disabled={saving || deleting}
          accessibilityRole="button"
          accessibilityLabel="Set as expense"
          accessibilityState={{ selected: type === 'expense' }}
          onPress={() => handleSelectType('expense')}
          style={[
            styles.typeOption,
            type === 'expense' && styles.typeOptionSelected,
          ]}
        >
          <Text
            style={[
              styles.typeOptionText,
              type === 'expense' && styles.typeOptionTextSelected,
            ]}
          >
            Expense
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          disabled={saving || deleting}
          accessibilityRole="button"
          accessibilityLabel="Set as income"
          accessibilityState={{ selected: type === 'income' }}
          onPress={() => handleSelectType('income')}
          style={[
            styles.typeOption,
            type === 'income' && styles.typeOptionSelectedIncome,
          ]}
        >
          <Text
            style={[
              styles.typeOptionText,
              type === 'income' && styles.typeOptionTextSelectedIncome,
            ]}
          >
            Income (+)
          </Text>
        </AnimatedPressable>
      </View>

      <Text style={styles.label}>Amount in rupiah</Text>
      <TextInput
        accessibilityLabel="Amount in rupiah"
        editable={!saving && !deleting}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        style={styles.input}
        selectTextOnFocus
      />
      <Text style={styles.label}>Category</Text>
      <View style={styles.options}>
        {categories.map(option => (
          <AnimatedPressable
            key={option}
            disabled={saving || deleting}
            accessibilityState={{ selected: category === option }}
            onPress={() => handleSelectCategory(option)}
            style={[styles.chip, category === option && styles.chipSelected]}
          >
            <Text style={category === option ? styles.activeText : styles.meta}>
              {option}
            </Text>
          </AnimatedPressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Category"
        editable={!saving && !deleting}
        maxLength={60}
        style={styles.input}
        value={category}
        onChangeText={handleSelectCategory}
        placeholder="Or enter a category"
        placeholderTextColor={Colors.textSecondary}
      />
      <AnimatedPressable
        disabled={saving || deleting}
        onPress={() => setShowCalendar(!showCalendar)}
        style={styles.date}
      >
        <Text style={styles.label}>Expense date</Text>
        <Text style={styles.meta}>
          {date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          · Change
        </Text>
      </AnimatedPressable>
      {showCalendar && !saving && !deleting && (
        <Calendar
          value={date}
          onSelect={day => {
            const next = new Date(date);
            next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
            setDate(next);
            setShowCalendar(false);
          }}
        />
      )}
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        accessibilityLabel="Expense note"
        editable={!saving && !deleting}
        maxLength={500}
        multiline
        numberOfLines={2}
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Add context, details, or items…"
        placeholderTextColor={Colors.textSecondary}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {saving && (
        <Text accessibilityLiveRegion="polite" style={styles.meta}>
          Waiting for sync. You can close this panel; the pending change will
          stay visible on your phone.
        </Text>
      )}
      <AnimatedPressable
        disabled={saving || deleting}
        onPress={save}
        style={styles.save}
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : 'Save changes'}
        </Text>
      </AnimatedPressable>
      {onDelete && (
        <AnimatedPressable
          disabled={saving || deleting}
          onPress={() => setShowDeleteConfirm(true)}
          style={styles.deleteButton}
          accessibilityLabel="Delete expense"
        >
          <Text style={styles.deleteButtonText}>Delete expense</Text>
        </AnimatedPressable>
      )}
      <AnimatedPressable
        disabled={saving || deleting}
        onPress={onClose}
        style={styles.cancel}
      >
        <Text style={styles.meta}>{saving ? 'Close' : 'Cancel'}</Text>
      </AnimatedPressable>

      {showDeleteConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Delete this transaction?</Text>
            <Text style={styles.confirmMessage}>
              This will permanently remove this record of Rp{' '}
              {Number(amount) > 0
                ? Number(amount).toLocaleString('id-ID')
                : amount}{' '}
              ({category}) from your history.
            </Text>
            <View style={styles.confirmActions}>
              <AnimatedPressable
                disabled={deleting}
                onPress={handleDelete}
                style={styles.deleteConfirmButton}
                accessibilityLabel="Confirm delete expense"
              >
                <Text style={styles.deleteConfirmText}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                disabled={deleting}
                onPress={() => setShowDeleteConfirm(false)}
                style={styles.cancelConfirmButton}
                accessibilityLabel="Cancel delete"
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  meta: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  typeOptionSelectedIncome: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  typeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  typeOptionTextSelectedIncome: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: Colors.textPrimary,
    minHeight: 56,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.background,
  },
  chipSelected: { backgroundColor: Colors.mint },
  activeText: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
  date: { minHeight: 56, justifyContent: 'center', gap: 4 },
  error: { color: Colors.danger, fontSize: 14 },
  save: {
    backgroundColor: Colors.accent,
    minHeight: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  deleteButtonText: {
    color: '#C62828',
    fontSize: 15,
    fontWeight: '600',
  },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
    borderRadius: 24,
  },
  confirmBox: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
});
