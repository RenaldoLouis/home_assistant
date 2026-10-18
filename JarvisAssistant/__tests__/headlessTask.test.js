const mockGenerateContent = jest.fn();
let mockNextId = 0;
const mockSavedExpenses = new Map();
const mockPendingExpenses = new Map();

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  actual.NativeModules.NotificationManagerModule = {
    enqueueNotificationExpense: jest.fn(async (uid, id, payload) => {
      const key = `${uid}/${id}`;
      if (!mockPendingExpenses.has(key)) mockPendingExpenses.set(key, payload);
    }),
    getPendingNotificationExpenses: jest.fn(async uid =>
      [...mockPendingExpenses.values()].filter(
        payload => JSON.parse(payload).userId === uid,
      ),
    ),
    removePendingNotificationExpense: jest.fn(async (uid, id) => {
      mockPendingExpenses.delete(`${uid}/${id}`);
    }),
  };
  return actual;
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  })),
}));

jest.mock('react-native-get-random-values', () => {
  global.__jarvisRandomValuesPolyfilled = true;
});

jest.mock('uuid', () => {
  const v5 = jest.fn(value =>
    require('crypto').createHash('sha256').update(value).digest('hex'),
  );
  v5.URL = 'test-namespace';
  return {
    v5,
    v4: jest.fn(() => {
      if (!global.__jarvisRandomValuesPolyfilled) {
        throw new Error('crypto.getRandomValues() not supported');
      }

      return `expense-id-${++mockNextId}`;
    }),
  };
});

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'firestore' })),
  collection: jest.fn((...args) => ({ type: 'collection', args })),
  doc: jest.fn((...args) => ({ type: 'doc', args })),
  getDoc: jest.fn(async ref => ({
    exists: () => mockSavedExpenses.has(JSON.stringify(ref)),
  })),
  setDoc: jest.fn(async (ref, expense) => {
    mockSavedExpenses.set(JSON.stringify(ref), expense);
  }),
  runTransaction: jest.fn(async (_db, update) => {
    const sdk = require('@react-native-firebase/firestore');
    const writes = [];
    await update({
      get: sdk.getDoc,
      set: (ref, expense) => writes.push([ref, expense]),
    });
    for (const [ref, expense] of writes) await sdk.setDoc(ref, expense);
  }),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

import { collection, getDoc, setDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import headlessTask from '../headlessTask';
import { NativeModules } from 'react-native';
import { flushPendingNotificationExpenses } from '../src/notifications/notificationExpenseStore';

beforeEach(() => {
  getAuth().currentUser = { uid: 'signed-in-uid' };
});

describe('notification expense headless task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSavedExpenses.clear();
    mockPendingExpenses.clear();
  });

  it('saves only one expense when the same notification arrives concurrently', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600100',
    };

    await Promise.all([
      headlessTask({ notification }),
      headlessTask({ notification: JSON.stringify(notification) }),
    ]);

    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an expense when its notification is delivered again later', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600101',
    };

    await headlessTask({ notification });
    await headlessTask({ notification });

    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('keeps separate purchases with identical values at different posting times', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600200',
    };

    await headlessTask({ notification });
    await headlessTask({
      notification: { ...notification, time: '1796469600201' },
    });

    expect(mockSavedExpenses.size).toBe(2);
  });

  it('drains a new capture that arrives while an empty drain is finishing', async () => {
    const queue = NativeModules.NotificationManagerModule;
    let releaseEmptyList;
    queue.getPendingNotificationExpenses.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          releaseEmptyList = resolve;
        }),
    );
    const first = flushPendingNotificationExpenses('signed-in-uid');
    releaseEmptyList([]);
    await Promise.resolve();
    const enqueue = queue.enqueueNotificationExpense(
      'signed-in-uid',
      'late-capture',
      JSON.stringify({
        id: 'late-capture',
        userId: 'signed-in-uid',
        ledgerId: 'signed-in-uid',
        amount: 25000,
        merchant: 'Food',
        category: 'Food',
        bank: 'BCA',
        type: 'expense',
        date: '2026-10-18T00:00:00.000Z',
        dateSource: 'notification',
        sourceApp: 'id.co.bca.mybca',
        sourceTitle: 'Financial Diary',
      }),
    );
    const second = flushPendingNotificationExpenses('signed-in-uid');
    await Promise.all([first, enqueue, second]);

    expect(mockSavedExpenses.size).toBe(1);
    expect(mockPendingExpenses.size).toBe(0);
  });

  it('preserves saved corrections when a notification replays after a JS restart', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600300',
    };
    await headlessTask({ notification });
    const [key, saved] = [...mockSavedExpenses.entries()][0];
    mockSavedExpenses.set(key, { ...saved, category: 'Dating', amount: 20000 });

    let restartedTask;
    jest.isolateModules(() => {
      require('@react-native-firebase/auth').getAuth().currentUser = {
        uid: 'signed-in-uid',
      };
      restartedTask = require('../headlessTask').default;
    });
    await restartedTask({ notification });

    expect([...mockSavedExpenses.values()]).toEqual([
      expect.objectContaining({ category: 'Dating', amount: 20000 }),
    ]);
  });

  it('does not share duplicate tracking between accounts', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600400',
    };
    await headlessTask({ notification });
    getAuth().currentUser = { uid: 'another-uid' };
    await headlessTask({ notification });

    expect(
      [...mockSavedExpenses.values()].map(expense => expense.userId),
    ).toEqual(['signed-in-uid', 'another-uid']);
  });

  it('allows a retry after the database write fails', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600500',
    };
    setDoc.mockRejectedValueOnce(new Error('save failed'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await headlessTask({ notification });
      await headlessTask({ notification });
      expect(mockSavedExpenses.size).toBe(1);
    } finally {
      log.mockRestore();
    }
  });

  it('retains an offline first capture locally until it can safely create the expense', async () => {
    getDoc.mockRejectedValueOnce({ code: 'firestore/unavailable' });
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 25.000 at Food.',
        time: '1796469600600',
      },
    });

    expect(mockSavedExpenses.size).toBe(0);
    expect(mockPendingExpenses.size).toBe(1);
    await flushPendingNotificationExpenses('signed-in-uid');
    expect(mockSavedExpenses.size).toBe(1);
    expect(mockPendingExpenses.size).toBe(0);
  });

  it('does not replace a corrected remote expense after an offline cache miss', async () => {
    const notification = {
      app: 'id.co.bca.mybca',
      title: 'Financial Diary',
      text: 'You spent IDR 25.000 at Food.',
      time: '1796469600700',
    };
    await headlessTask({ notification });
    const [key, saved] = [...mockSavedExpenses.entries()][0];
    mockSavedExpenses.set(key, { ...saved, category: 'Dating', amount: 20000 });
    getDoc.mockRejectedValueOnce({ code: 'firestore/unavailable' });
    await headlessTask({ notification });

    expect([...mockSavedExpenses.values()]).toEqual([
      expect.objectContaining({ category: 'Dating', amount: 20000 }),
    ]);
    await flushPendingNotificationExpenses('signed-in-uid');
    expect(mockPendingExpenses.size).toBe(0);
    expect([...mockSavedExpenses.values()]).toEqual([
      expect.objectContaining({ category: 'Dating', amount: 20000 }),
    ]);
  });

  it('recovers an offline capture after a JS restart without another notification', async () => {
    getDoc.mockRejectedValueOnce({ code: 'firestore/unavailable' });
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 25.000 at Food.',
        time: '1796469600800',
      },
    });
    expect(mockSavedExpenses.size).toBe(0);
    let flushAfterRestart;
    jest.isolateModules(() => {
      require('@react-native-firebase/auth').getAuth().currentUser = {
        uid: 'signed-in-uid',
      };
      flushAfterRestart =
        require('../src/notifications/notificationExpenseStore').flushPendingNotificationExpenses;
    });
    await flushAfterRestart('signed-in-uid');
    expect(mockSavedExpenses.size).toBe(1);
    expect(mockPendingExpenses.size).toBe(0);
  });

  it('keeps an offline capture with its original account until that account signs back in', async () => {
    getDoc.mockRejectedValueOnce({ code: 'firestore/unavailable' });
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 25.000 at Food.',
        time: '1796469600900',
      },
    });
    getAuth().currentUser = { uid: 'another-uid' };
    await flushPendingNotificationExpenses('signed-in-uid');
    await flushPendingNotificationExpenses('another-uid');
    expect(mockSavedExpenses.size).toBe(0);
    expect(mockPendingExpenses.size).toBe(1);
    getAuth().currentUser = { uid: 'signed-in-uid' };
    await flushPendingNotificationExpenses('signed-in-uid');
    expect([...mockSavedExpenses.values()]).toEqual([
      expect.objectContaining({ userId: 'signed-in-uid' }),
    ]);
    expect(mockPendingExpenses.size).toBe(0);
  });

  it.each([undefined, 'invalid'])(
    'keeps separate captures when posting time is %s',
    async time => {
      const notification = {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 25.000 at Food.',
        time,
      };
      await headlessTask({ notification });
      await headlessTask({ notification });

      expect(mockSavedExpenses.size).toBe(2);
    },
  );

  it('saves into the signed-in user’s own folder', async () => {
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 12.000 at Food.',
        time: '1796469600003',
      },
    });

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'signed-in-uid',
      'expenses',
    );
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'signed-in-uid',
        ledgerId: 'signed-in-uid',
      }),
    );
  });

  it('does not save when nobody is signed in, since the rules would refuse it', async () => {
    getAuth().currentUser = null;

    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 12.000 at Food.',
        time: '1796469600004',
      },
    });

    expect(setDoc).not.toHaveBeenCalled();
  });

  it('saves a Financial Diary spending notification by parsing the amount locally', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network unavailable'));

    await headlessTask({
      notification: JSON.stringify({
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 250,580.00 at Food & Beverage.',
        time: '1796469600000',
      }),
    });

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: expect.any(String),
        amount: 250580,
        merchant: 'Food & Beverage',
        category: 'Food & Beverage',
        bank: 'BCA',
        notificationTime: '1796469600000',
      }),
    );
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty('rawText');
  });

  it('uses alternate notification text fields when Android leaves text empty', async () => {
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: '',
        bigText: 'You spent IDR 42.500 at Transport.',
        time: '1796469600001',
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: 42500,
        merchant: 'Transport',
        category: 'Transport',
        bank: 'BCA',
      }),
    );
  });

  it('saves an income notification with type income and sender merchant', async () => {
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You received IDR 68,000.00 from ***ANI ***RIA **BR at Account Transfer ...',
        time: '1796469600002',
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: expect.any(String),
        amount: 68000,
        merchant: '***ANI ***RIA **BR',
        category: 'Income',
        type: 'income',
        bank: 'BCA',
      }),
    );
  });
});

it('uses notification posting time when a delayed expense is processed after midnight', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-11T01:00:00.000Z'));
  try {
    await headlessTask({
      notification: {
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 25.000 at Food.',
        time: String(Date.parse('2026-09-10T16:55:00.000Z')),
      },
    });
    expect(setDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        date: '2026-09-10T16:55:00.000Z',
        dateSource: 'notification',
      }),
    );
  } finally {
    jest.useRealTimers();
  }
});
