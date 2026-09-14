/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Linking } from 'react-native';
import { updateDoc, deleteDoc } from '@react-native-firebase/firestore';
import App from '../App';
import { ToolExecutionHandlers } from '../src/services/JarvisToolExecutor';


jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
const mockSetToolHandlers = jest.fn();
const mockStopSession = jest.fn();
const mockStartSession = jest.fn();
const mockSendTextMessage = jest.fn();
const mockCreateService = jest.fn();
const mockSetSystemInstruction = jest.fn();
jest.mock('../src/services/GeminiLiveService', () => ({
  GeminiLiveService: jest.fn().mockImplementation(() => {
    mockCreateService();
    return {
      on: jest.fn(() => jest.fn()),
      setToolHandlers: mockSetToolHandlers,
      setSystemInstruction: mockSetSystemInstruction,
      startSession: mockStartSession,
      stopSession: mockStopSession,
      sendTextMessage: mockSendTextMessage,
    };
  }),
  buildJarvisSystemInstruction: jest.fn(
    (ctx?: string) => `MOCK_INSTRUCTION: ${ctx || ''}`,
  ),
}));


interface DashboardProps {
  expenses: Array<{
    id: string;
    amount: number;
    merchant: string;
    category: string;
    bank: string;
    date: string;
    note?: string;
  }>;
  categoryOptions: string[];
  saveFailed: boolean;
  onRetrySave: () => void;
  onExpenseSave: (
    expenseId: string,
    edit: {
      amount: number;
      category: string;
      date: string;
      type?: 'expense' | 'income';
      note?: string;
    },
  ) => Promise<void>;
  onExpenseDelete?: (expenseId: string) => Promise<void>;
  onStartDailyReview?: () => void;
}

const mockDashboardScreen = jest.fn((_props: DashboardProps) => null);
let mockSnapshotUpdate: (snapshot: {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
}) => void;
const mockExpenseDocRef = {
  path: 'users/jarvis_user_id/expenses/expense-id-1',
};
let mockExpenseDocs: Array<{
  id: string;
  data: () => Record<string, unknown>;
}> = [];

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-android-notification-listener', () => ({
  __esModule: true,
  default: {

    getPermissionStatus: jest.fn(() => Promise.resolve('authorized')),
    requestPermission: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'firestore' })),
  collection: jest.fn((...args) => ({ args })),
  onSnapshot: jest.fn((_ref, _options, onNext) => {
    mockSnapshotUpdate = onNext;
    onNext({ docs: mockExpenseDocs });
    return jest.fn();
  }),
  doc: jest.fn(() => mockExpenseDocRef),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../src/screens/DashboardScreen', () => ({
  DashboardScreen: (props: DashboardProps) => mockDashboardScreen(props),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockExpenseDocs = [];
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
});

test('saves amount and category corrections to the existing document', async () => {
  mockExpenseDocs = [
    {
      id: 'expense-id-1',
      data: () => ({
        id: 'incorrect-legacy-id',
        amount: 25000,
        category: 'Food',
        date: '2026-09-10T05:00:00.000Z',
      }),
    },
  ];
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const latestCall = mockDashboardScreen.mock.calls[
    mockDashboardScreen.mock.calls.length - 1
  ] as [DashboardProps];
  const latestProps = latestCall[0];

  expect(latestProps.categoryOptions).toContain('Dating');
  expect(latestProps.categoryOptions).toContain('Income');

  await ReactTestRenderer.act(async () => {
    await latestProps.onExpenseSave('expense-id-1', {
      amount: 18000,
      category: 'Dating',
      date: '2026-09-10T05:00:00.000Z',
    });
  });

  expect(updateDoc).toHaveBeenCalledWith(mockExpenseDocRef, {
    category: 'Dating',
    amount: 18000,
    date: '2026-09-10T05:00:00.000Z',
    type: 'expense',
    originalAmount: 25000,
    originalCategory: 'Food',
    note: '',
    updatedAt: 'SERVER_TIMESTAMP',
  });
});

test('parses and persists custom note on expenses', async () => {
  mockExpenseDocs = [
    {
      id: 'expense-id-1',
      data: () => ({
        amount: 50000,
        category: 'Food',
        date: '2026-09-10T05:00:00.000Z',
        note: 'Special dinner with family',
      }),
    },
  ];

  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const latestCall = mockDashboardScreen.mock.calls[
    mockDashboardScreen.mock.calls.length - 1
  ] as [DashboardProps];
  const latestProps = latestCall[0];

  expect(latestProps.expenses[0].note).toBe('Special dinner with family');

  await ReactTestRenderer.act(async () => {
    await latestProps.onExpenseSave('expense-id-1', {
      amount: 50000,
      category: 'Food',
      date: '2026-09-10T05:00:00.000Z',
      note: 'Updated dinner note',
    });
  });

  expect(updateDoc).toHaveBeenCalledWith(mockExpenseDocRef, {
    category: 'Food',
    amount: 50000,
    date: '2026-09-10T05:00:00.000Z',
    type: 'expense',
    originalAmount: 50000,
    originalCategory: 'Food',
    note: 'Updated dinner note',
    updatedAt: 'SERVER_TIMESTAMP',
  });
});


test('passes Firestore timestamp expenses through to the dashboard list', async () => {
  mockExpenseDocs = [
    {
      id: 'expense-yesterday',
      data: () => ({
        amount: 250580,
        merchant: 'Food & Beverage',
        category: 'Food & Beverage',
        bank: 'BCA',
        createdAt: {
          seconds: 1788584400,
          nanoseconds: 0,
        },
      }),
    },
  ];

  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const latestCall = mockDashboardScreen.mock.calls[
    mockDashboardScreen.mock.calls.length - 1
  ] as [DashboardProps];
  const latestProps = latestCall[0];

  expect(latestProps.expenses).toEqual([
    expect.objectContaining({
      id: 'expense-yesterday',
      amount: 250580,
      merchant: 'Food & Beverage',
      category: 'Food & Beverage',
      bank: 'BCA',
    }),
  ]);
});

test('answers a requested local day and refreshes totals without restarting the voice service', async () => {
  mockExpenseDocs = [
    {
      id: 'one',
      data: () => ({
        amount: 25000,
        category: 'Food',
        date: new Date(2026, 8, 8, 12).toISOString(),
      }),
    },
  ];
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const handlers: ToolExecutionHandlers =
    mockSetToolHandlers.mock.calls[
      mockSetToolHandlers.mock.calls.length - 1
    ][0];
  expect(await handlers.onGetDailyRecap?.({ date: '2026-09-08' })).toContain(
    '25.000',
  );
  expect(await handlers.onGetDailyRecap?.({ date: '2026-09-09' })).toContain(
    'IDR 0',
  );
  expect(await handlers.onGetDailyRecap?.({ date: '2026-02-30' })).toContain(
    'valid date',
  );
  expect(await handlers.onControlLight?.({ state: false })).toMatchObject({
    success: false,
  });
  await ReactTestRenderer.act(async () =>
    mockSnapshotUpdate({
      docs: [
        {
          id: 'one',
          data: () => ({
            amount: 18000,
            category: 'Dating',
            date: new Date(2026, 8, 8, 12).toISOString(),
          }),
        },
      ],
    }),
  );
  const updatedHandlers: ToolExecutionHandlers =
    mockSetToolHandlers.mock.calls[
      mockSetToolHandlers.mock.calls.length - 1
    ][0];
  expect(
    await updatedHandlers.onGetDailyRecap?.({ date: '2026-09-08' }),
  ).toContain('18.000');
  expect(mockCreateService).toHaveBeenCalledTimes(1);
  expect(mockStopSession).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('keeps a rejected correction visible outside the editor and allows retry', async () => {
  mockExpenseDocs = [
    {
      id: 'one',
      data: () => ({
        amount: 25000,
        category: 'Food',
        date: new Date(2026, 8, 8, 12).toISOString(),
      }),
    },
  ];
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const dashboard = () =>
    mockDashboardScreen.mock.calls[
      mockDashboardScreen.mock.calls.length - 1
    ][0];
  jest.mocked(updateDoc).mockRejectedValueOnce(new Error('permission-denied'));
  await ReactTestRenderer.act(async () => {
    await expect(
      dashboard().onExpenseSave('one', {
        amount: 18000,
        category: 'Dating',
        date: new Date(2026, 8, 8, 12).toISOString(),
      }),
    ).rejects.toThrow();
  });
  expect(dashboard().saveFailed).toBe(true);
  await ReactTestRenderer.act(async () => dashboard().onRetrySave());
  expect(updateDoc).toHaveBeenCalledTimes(2);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('updates system instruction with dynamic daily spending context', async () => {
  mockExpenseDocs = [
    {
      id: 'today-expense',
      data: () => ({
        amount: 45000,
        category: 'Food',
        date: new Date().toISOString(),
      }),
    },
  ];
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(mockSetSystemInstruction).toHaveBeenCalled();
  const latestInstructionCall =
    mockSetSystemInstruction.mock.calls[
      mockSetSystemInstruction.mock.calls.length - 1
    ][0];
  expect(latestInstructionCall).toContain('45.000');
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('launches Spotify intent when onPlayMusic tool handler executes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const handlers: ToolExecutionHandlers =
    mockSetToolHandlers.mock.calls[
      mockSetToolHandlers.mock.calls.length - 1
    ][0];

  const canOpenSpy = jest
    .spyOn(Linking, 'canOpenURL')
    .mockResolvedValue(true as never);
  const openSpy = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(true as never);

  const result = await handlers.onPlayMusic?.({ app: 'spotify' });

  expect(canOpenSpy).toHaveBeenCalledWith('spotify:play');
  expect(openSpy).toHaveBeenCalledWith('spotify:play');
  expect(result?.success).toBe(true);
  expect(result?.message).toContain('Spotify');

  canOpenSpy.mockRestore();
  openSpy.mockRestore();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('deletes expense when onExpenseDelete is called', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const lastCallProps =
    mockDashboardScreen.mock.calls[mockDashboardScreen.mock.calls.length - 1][0];
  await ReactTestRenderer.act(async () => {
    await lastCallProps.onExpenseDelete?.('expense-to-delete');
  });
  expect(deleteDoc).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('executes onUpdateExpense, onDeleteExpense, and onGetDailyExpenses tool handlers', async () => {
  mockExpenseDocs = [
    {
      id: 'exp-1',
      data: () => ({
        amount: 25000,
        category: 'Food',
        merchant: 'Cafe',
        bank: 'BCA',
        date: new Date().toISOString(),
        note: 'lunch',
      }),
    },
  ];
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const handlers: ToolExecutionHandlers =
    mockSetToolHandlers.mock.calls[
      mockSetToolHandlers.mock.calls.length - 1
    ][0];

  const updateResult = await handlers.onUpdateExpense?.({
    expense_id: 'exp-1',
    category: 'Coffee',
    note: 'latte',
  });
  expect(updateResult?.success).toBe(true);
  expect(updateDoc).toHaveBeenCalled();

  const deleteResult = await handlers.onDeleteExpense?.({
    expense_id: 'exp-1',
  });
  expect(deleteResult?.success).toBe(true);
  expect(deleteDoc).toHaveBeenCalled();

  const getResult = await handlers.onGetDailyExpenses?.();
  expect(
    getResult &&
      'expenses' in getResult &&
      Array.isArray(getResult.expenses) &&
      getResult.expenses.length,
  ).toBe(1);

  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('starts daily review when onStartDailyReview is called', async () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const lastCallProps =
    mockDashboardScreen.mock.calls[mockDashboardScreen.mock.calls.length - 1][0];
  await ReactTestRenderer.act(async () => {
    lastCallProps.onStartDailyReview?.();
  });
  expect(mockStartSession).toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1100);
  });
  expect(mockSendTextMessage).toHaveBeenCalledWith(
    expect.stringContaining('daily spending review'),
  );
  jest.useRealTimers();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

