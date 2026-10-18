import { NativeModules } from 'react-native';
import {
  collection,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { getActiveUserId } from '../auth/authService';
import { TransactionType } from '../expenses/types';

interface PendingNotificationExpense {
  id: string;
  userId: string;
  ledgerId: string;
  amount: number;
  merchant: string;
  category: string;
  bank: string;
  type: TransactionType;
  date: string;
  dateSource: 'notification' | 'capture';
  sourceApp: string;
  sourceTitle: string;
  notificationTime?: string;
}

const flushes = new Map<string, Promise<void>>();
const flushRequested = new Set<string>();

export async function saveNotificationExpense(
  expense: PendingNotificationExpense,
) {
  const queue = NativeModules.NotificationManagerModule;
  if (!queue?.enqueueNotificationExpense) {
    throw new Error('Notification capture requires the updated Android build.');
  }
  await queue.enqueueNotificationExpense(
    expense.userId,
    expense.id,
    JSON.stringify(expense),
  );
  await flushPendingNotificationExpenses(expense.userId);
}

export function flushPendingNotificationExpenses(
  userId: string,
): Promise<void> {
  const queue = NativeModules.NotificationManagerModule;
  if (!queue?.getPendingNotificationExpenses || getActiveUserId() !== userId) {
    return Promise.resolve();
  }
  flushRequested.add(userId);
  const current = flushes.get(userId);
  if (current) {
    return current;
  }

  const flush = (async () => {
    do {
      flushRequested.delete(userId);
      const pending: string[] = await queue.getPendingNotificationExpenses(
        userId,
      );
      for (const payload of pending) {
        if (getActiveUserId() !== userId) {
          return;
        }
        const expense: PendingNotificationExpense = JSON.parse(payload);
        if (expense.userId !== userId || expense.ledgerId !== userId) {
          throw new Error('Pending notification account mismatch.');
        }
        const ref = doc(
          collection(getFirestore(), 'users', userId, 'expenses'),
          expense.id,
        );
        await runTransaction(getFirestore(), async transaction => {
          const existing = await transaction.get(ref);
          if (getActiveUserId() !== userId) {
            throw new Error('Notification account changed during save.');
          }
          if (!existing.exists()) {
            transaction.set(ref, { ...expense, createdAt: serverTimestamp() });
          }
        });
        await queue.removePendingNotificationExpense(userId, expense.id);
      }
    } while (flushRequested.has(userId));
  })()
    .catch(() => {
      // Keep the durable entry on any failure; do not log financial payloads.
      console.warn(
        '[Jarvis] Pending notification expenses will retry when online.',
      );
    })
    .finally(() => {
      flushes.delete(userId);
      // A new capture can join after the loop exits but before this cleanup.
      // Keep its callers waiting until that late request has also been drained.
      if (flushRequested.delete(userId)) {
        return flushPendingNotificationExpenses(userId);
      }
      return undefined;
    });
  flushes.set(userId, flush);
  return flush;
}
