import 'react-native-get-random-values';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { JARVIS_USER_ID } from './src/expenses/constants';
import { parseExpenseNotification } from './src/notifications/expenseNotificationParser';
import { getActiveUserId } from './src/auth/authService';

const headlessTask = async ({ notification }) => {
  try {
    const expenseData = parseExpenseNotification(notification);

    if (!expenseData) {
      console.log(
        '[Jarvis Headless] Notification did not contain a Financial Diary expense.',
      );
      return;
    }

    // Android's listener exposes StatusBarNotification.getPostTime() as epoch milliseconds.
    const postedAt = Number(expenseData.notificationTime);
    const capturedAt = Date.now();
    const validPostedAt =
      Number.isSafeInteger(postedAt) && postedAt > 0 && postedAt <= capturedAt;
    const activeUid = getActiveUserId();
    const expenseId = uuidv4();
    const savedExpense = {
      id: expenseId,
      userId: activeUid,
      ledgerId: activeUid,
      amount: expenseData.amount,
      merchant: expenseData.merchant,
      category: expenseData.category,
      bank: expenseData.bank,
      type: expenseData.type || 'expense',
      date: new Date(validPostedAt ? postedAt : capturedAt).toISOString(),
      dateSource: validPostedAt ? 'notification' : 'capture',
      sourceApp: expenseData.sourceApp,
      sourceTitle: expenseData.sourceTitle,
      createdAt: serverTimestamp(),
    };

    if (expenseData.notificationTime) {
      savedExpense.notificationTime = expenseData.notificationTime;
    }

    const db = getFirestore();
    const expenseRef = doc(
      collection(db, 'users', activeUid, 'expenses'),
      expenseId,
    );

    await setDoc(expenseRef, savedExpense);

    console.log('[Jarvis Headless] Saved expense.');
  } catch (error) {
    console.error(
      '[Jarvis Headless] Error in notification listener headless task:',
      error,
    );
  }
};

export default headlessTask;
