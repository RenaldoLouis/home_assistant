/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { updateDoc } from '@react-native-firebase/firestore';
import App from '../App';

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
  onExpenseCategoryChange: (expenseId: string, category: string) => Promise<void>;
}

const mockDashboardScreen = jest.fn((_props: DashboardProps) => null);
const mockExpenseDocRef = { path: 'users/jarvis_user_id/expenses/expense-id-1' };
let mockExpenseDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

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
  onSnapshot: jest.fn((_ref, onNext) => {
    onNext({ docs: mockExpenseDocs });
    return jest.fn();
  }),
  doc: jest.fn(() => mockExpenseDocRef),
  updateDoc: jest.fn(() => Promise.resolve()),
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

test('passes Dating as an editable category and updates category changes', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const latestCall = mockDashboardScreen.mock.calls[
    mockDashboardScreen.mock.calls.length - 1
  ] as [DashboardProps];
  const latestProps = latestCall[0];

  expect(latestProps.categoryOptions).toContain('Dating');

  await latestProps.onExpenseCategoryChange('expense-id-1', 'Dating');

  expect(updateDoc).toHaveBeenCalledWith(mockExpenseDocRef, {
    category: 'Dating',
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
