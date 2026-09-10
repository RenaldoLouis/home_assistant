const mockGenerateContent = jest.fn();

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

jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    if (!global.__jarvisRandomValuesPolyfilled) {
      throw new Error('crypto.getRandomValues() not supported');
    }

    return 'expense-id-1';
  }),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'firestore' })),
  collection: jest.fn((...args) => ({ type: 'collection', args })),
  doc: jest.fn((...args) => ({ type: 'doc', args })),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

import { setDoc } from '@react-native-firebase/firestore';
import headlessTask from '../headlessTask';

describe('notification expense headless task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        id: 'expense-id-1',
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
