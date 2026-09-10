import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { EditableExpense, ExpenseEdit } from '../expenses/types';
import { buildExpenseUpdate } from '../expenses/expenseEditing';
import { AnimatedPressable } from './AnimatedPressable';
import { Calendar } from './Calendar';
import { Sheet } from './Sheet';
import { Colors } from '../theme/colors';

export function ExpenseEditor({
  expense,
  categories,
  onSave,
  onClose,
}: {
  expense: EditableExpense;
  categories: string[];
  onSave: (id: string, edit: ExpenseEdit) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(new Date(expense.date));
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = async () => {
    if (inFlight.current) return;
    const edit = {
      amount: /^\d+$/.test(amount.trim()) ? Number(amount) : NaN,
      category,
      date: date.toISOString(),
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
  return (
    <Sheet title="Edit expense" onClose={onClose}>
      <Text style={styles.meta}>
        {expense.bank} · Changes update your spending totals.
      </Text>
      <Text style={styles.label}>Amount in rupiah</Text>
      <TextInput
        accessibilityLabel="Amount in rupiah"
        editable={!saving}
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
            disabled={saving}
            accessibilityState={{ selected: category === option }}
            onPress={() => setCategory(option)}
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
        editable={!saving}
        maxLength={60}
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="Or enter a category"
        placeholderTextColor={Colors.textSecondary}
      />
      <AnimatedPressable
        disabled={saving}
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
      {showCalendar && !saving && (
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
      <AnimatedPressable disabled={saving} onPress={save} style={styles.save}>
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : 'Save changes'}
        </Text>
      </AnimatedPressable>
      <AnimatedPressable onPress={onClose} style={styles.cancel}>
        <Text style={styles.meta}>{saving ? 'Close' : 'Cancel'}</Text>
      </AnimatedPressable>
    </Sheet>
  );
}
const styles = StyleSheet.create({
  meta: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
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
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
