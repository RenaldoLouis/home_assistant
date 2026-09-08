import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { getFirestore, collection, doc, onSnapshot, updateDoc } from '@react-native-firebase/firestore';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrbState } from './src/components/JarvisOrb';
import { JARVIS_USER_ID } from './src/expenses/constants';
import { buildExpenseSummary } from './src/expenses/expenseSummary';
import {
  buildExpenseCategoryOptions,
  normalizeExpenseCategory,
} from './src/expenses/categories';
import { EditableExpense } from './src/expenses/types';

export default function App() {
  const [isRecordingCommand, setIsRecordingCommand] = useState(false);
  const [commandText] = useState('');
  const [notifPermission, setNotifPermission] = useState<string>('unknown');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [dailyNotes, setDailyNotes] = useState('');
  const [expenses, setExpenses] = useState<EditableExpense[]>([]);
  
  const [expenseData, setExpenseData] = useState({
    today: 0,
    lastWeek: 0,
    lastMonth: 0,
    chartData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
    }
  });

  // Check notification listener permission
  const checkNotificationPermission = useCallback(async () => {
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      console.log('[Jarvis] Notification listener permission status:', status);
      setNotifPermission(status);
      if (status !== 'authorized') {
        setShowNotifModal(true);
      } else {
        setShowNotifModal(false);
      }
    } catch (err) {
      console.warn('[Jarvis] Failed to check notification permission:', err);
    }
  }, []);

  // Check notification permission on mount and when app returns to foreground
  useEffect(() => {
    checkNotificationPermission();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Re-check when user comes back from Settings
        checkNotificationPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkNotificationPermission]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const db = getFirestore();
      const expensesRef = collection(db, 'users', JARVIS_USER_ID, 'expenses');

      unsubscribe = onSnapshot(
        expensesRef,
        snapshot => {
          const savedExpenses = snapshot.docs
            .map(expenseDoc => toEditableExpense(expenseDoc.id, expenseDoc.data()))
            .filter((expense): expense is EditableExpense => expense !== null)
            .sort((first, second) => Date.parse(second.date) - Date.parse(first.date));

          setExpenses(savedExpenses);
          setExpenseData(buildExpenseSummary(savedExpenses));
        },
        err => {
          console.warn('[Jarvis] Failed to subscribe to expense updates:', err);
        },
      );
    } catch (err) {
      console.warn('[Jarvis] Failed to start expense subscription:', err);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const categoryOptions = useMemo(
    () => buildExpenseCategoryOptions(expenses.map(expense => expense.category)),
    [expenses],
  );

  const handleExpenseCategoryChange = useCallback(async (expenseId: string, category: string) => {
    const db = getFirestore();
    const expenseRef = doc(collection(db, 'users', JARVIS_USER_ID, 'expenses'), expenseId);

    await updateDoc(expenseRef, {
      category: normalizeExpenseCategory(category),
    });
  }, []);

  const startListening = () => {
    setIsRecordingCommand(true);
  };

  const stopListening = () => {
    setIsRecordingCommand(false);
  };

  const orbState: OrbState = isRecordingCommand ? 'listening' : 'idle';

  return (
    <DashboardScreen 
      isRecordingCommand={isRecordingCommand}
      commandText={commandText}
      notifPermission={notifPermission}
      showNotifModal={showNotifModal}
      expenseData={expenseData}
      expenses={expenses}
      categoryOptions={categoryOptions}
      setShowNotifModal={setShowNotifModal}
      startListening={startListening}
      stopListening={stopListening}
      onExpenseCategoryChange={handleExpenseCategoryChange}
      onRequestNotifPermission={() => RNAndroidNotificationListener.requestPermission()}
      dailyNotes={dailyNotes}
      setDailyNotes={setDailyNotes}
      orbState={orbState}
    />
  );
}

function toEditableExpense(expenseId: string, data: Record<string, unknown>): EditableExpense | null {
  const amount = normalizeAmount(data.amount);
  const date = normalizeDate(data.date) ?? normalizeDate(data.createdAt);

  if (amount <= 0 || !date) {
    return null;
  }

  return {
    id: normalizeString(data.id) || expenseId,
    amount,
    merchant: normalizeString(data.merchant) || 'Unknown',
    category: normalizeExpenseCategory(data.category),
    bank: normalizeString(data.bank) || 'Unknown',
    date,
  };
}

function normalizeAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
}

function normalizeDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }

  if (
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    const nanoseconds =
      'nanoseconds' in value && typeof value.nanoseconds === 'number'
        ? value.nanoseconds
        : 0;
    const date = new Date(value.seconds * 1000 + Math.floor(nanoseconds / 1000000));

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
