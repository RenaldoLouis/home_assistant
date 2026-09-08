import 'react-native-get-random-values';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { JARVIS_USER_ID } from './src/expenses/constants';
import { parseExpenseNotification } from './src/notifications/expenseNotificationParser';

const headlessTask = async ({ notification }) => {
  console.log('[Jarvis Headless] Task fired. Notification received:', notification ? 'yes' : 'no');
  console.log('[Jarvis Headless] [DEBUG-NOTIF] Raw notification type:', typeof notification);

  // Log the raw payload so we can see exactly what arrives
  try {
    const preview = typeof notification === 'string'
      ? notification.slice(0, 500)
      : JSON.stringify(notification, null, 2)?.slice(0, 500);
    console.log('[Jarvis Headless] [DEBUG-NOTIF] Payload preview:', preview);
  } catch (e) {
    console.log('[Jarvis Headless] [DEBUG-NOTIF] Could not stringify payload:', e?.message);
  }

  // Log key fields individually
  if (notification && typeof notification === 'object') {
    console.log('[Jarvis Headless] [DEBUG-NOTIF] app:', notification.app);
    console.log('[Jarvis Headless] [DEBUG-NOTIF] title:', notification.title);
    console.log('[Jarvis Headless] [DEBUG-NOTIF] text:', notification.text);
    console.log('[Jarvis Headless] [DEBUG-NOTIF] bigText:', notification.bigText);
  }

  try {
    const expenseData = parseExpenseNotification(notification);

    console.log('[Jarvis Headless] [DEBUG-NOTIF] Parse result:', expenseData ? JSON.stringify(expenseData) : 'null (rejected)');

    if (!expenseData) {
      console.log('[Jarvis Headless] Notification did not contain a Financial Diary expense.');
      return;
    }

    const expenseId = uuidv4();
    const savedExpense = {
      id: expenseId,
      amount: expenseData.amount,
      merchant: expenseData.merchant,
      category: expenseData.category,
      bank: expenseData.bank,
      date: new Date().toISOString(),
      sourceApp: expenseData.sourceApp,
      sourceTitle: expenseData.sourceTitle,
      createdAt: serverTimestamp(),
    };

    if (expenseData.notificationTime) {
      savedExpense.notificationTime = expenseData.notificationTime;
    }

    const db = getFirestore();
    const expenseRef = doc(collection(db, 'users', JARVIS_USER_ID, 'expenses'), expenseId);

    await setDoc(expenseRef, savedExpense);

    console.log('[Jarvis Headless] Saved Financial Diary expense:', expenseData.amount, 'as', expenseData.category);
  } catch (error) {
    console.error('[Jarvis Headless] Error in notification listener headless task:', error);
  }
};

export default headlessTask;
