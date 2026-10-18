import 'react-native-get-random-values';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { parseExpenseNotification } from './src/notifications/expenseNotificationParser';
import { getActiveUserId } from './src/auth/authService';
import { saveNotificationExpense } from './src/notifications/notificationExpenseStore';

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
    const hasPostedAt = Number.isSafeInteger(postedAt) && postedAt > 0;
    const validPostedAt = hasPostedAt && postedAt <= capturedAt;
    const activeUid = getActiveUserId();
    if (!activeUid) {
      console.log('[Jarvis Headless] Nobody is signed in; expense not saved.');
      return;
    }
    // Use only scrubbed transaction fields. Re-delivery must target the same document.
    const expenseId = hasPostedAt
      ? uuidv5(
          JSON.stringify([
            expenseData.sourceApp,
            postedAt,
            expenseData.amount,
            expenseData.merchant,
            expenseData.type,
          ]),
          uuidv5.URL,
        )
      : uuidv4();
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
    };

    if (expenseData.notificationTime) {
      savedExpense.notificationTime = expenseData.notificationTime;
    }

    await saveNotificationExpense(savedExpense);
  } catch (error) {
    console.error(
      '[Jarvis Headless] Error in notification listener headless task:',
      error,
    );
  }
};

export default headlessTask;
