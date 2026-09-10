/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { updateDoc } from '@react-native-firebase/firestore';
import App from '../App';
import { ToolExecutionHandlers } from '../src/services/JarvisToolExecutor';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
const mockSetToolHandlers = jest.fn();
const mockStopSession = jest.fn();
const mockCreateService = jest.fn();
jest.mock('../src/services/GeminiLiveService', () => ({
  GeminiLiveService: jest.fn().mockImplementation(() => {
    mockCreateService();
    return {
      on: jest.fn(() => jest.fn()),
      setToolHandlers: mockSetToolHandlers,
      stopSession: mockStopSession,
    };
  }),
}));

interface DashboardProps {
  expenses: Array<{
    id: string;
    amount: number;
    merchant: string;
    category: string;
    bank: string;
    date: string;
  }>;
  categoryOptions: string[];
  saveFailed: boolean;
  onRetrySave: () => void;
  onExpenseSave: (
    expenseId: string,
    edit: { amount: number; category: string; date: string },
  ) => Promise<void>;
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

  await latestProps.onExpenseSave('expense-id-1', {
    amount: 18000,
    category: 'Dating',
    date: '2026-09-10T05:00:00.000Z',
  });

  expect(updateDoc).toHaveBeenCalledWith(mockExpenseDocRef, {
    category: 'Dating',
    amount: 18000,
    date: '2026-09-10T05:00:00.000Z',
    originalAmount: 25000,
    originalCategory: 'Food',
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
  expect(dashboard().saveFailed).toBe(false);
  expect(updateDoc).toHaveBeenCalledTimes(2);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
