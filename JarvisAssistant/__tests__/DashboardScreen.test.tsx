import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  DashboardScreen,
  DashboardScreenProps,
} from '../src/screens/DashboardScreen';
import { Linking, NativeModules, Text, TextInput } from 'react-native';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/components/AnimatedPressable', () => ({
  AnimatedPressable: require('react-native').Pressable,
}));
jest.mock('../src/components/Icon', () => ({
  Icon: () => null,
  categoryAppearance: () => ({
    icon: 'food',
    color: '#000',
    background: '#fff',
  }),
}));
let screen: Renderer.ReactTestRenderer;
const save = jest.fn(() => Promise.resolve());
const deleteMock = jest.fn(() => Promise.resolve());
const startReviewMock = jest.fn();
const props: DashboardScreenProps = {
  isRecordingCommand: false,
  commandText: '',
  orbState: 'idle',
  notifPermission: 'authorized',
  showNotifModal: false,
  expenses: [
    {
      id: 'one',
      amount: 25000,
      category: 'Food',
      merchant: 'Cafe',
      bank: 'BCA',
      date: new Date(2026, 8, 10, 12).toISOString(),
    },
    {
      id: 'two',
      amount: 10000,
      category: 'Transport',
      merchant: 'Transport',
      bank: 'BCA',
      date: new Date(2026, 8, 9, 12).toISOString(),
    },
  ],
  categoryOptions: ['Food', 'Transport', 'Dating', 'Income'],
  dataStatus: 'synced',
  setShowNotifModal: jest.fn(),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  onExpenseSave: save,
  onExpenseDelete: deleteMock,
  onRequestNotifPermission: jest.fn(),
  onRetry: jest.fn(),
  dailyNotes: '',
  setDailyNotes: jest.fn(),
  onStartDailyReview: startReviewMock,
};
const press = async (label: string) =>
  act(async () => {
    screen.root
      .findAllByProps({ accessibilityLabel: label })[0]
      .props.onPress();
  });
beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 10, 14));
  await act(async () => {
    screen = Renderer.create(<DashboardScreen {...props} />);
  });
});
afterEach(async () => {
  await act(async () => screen.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('selecting Wednesday shows only Wednesday expenses, with Today restoring the current day', async () => {
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 25.000' })
      .length,
  ).toBeGreaterThan(0);
  await press('Wed, Rp 10.000');
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 25.000' }),
  ).toHaveLength(0);
  expect(
    screen.root.findAllByProps({
      accessibilityLabel: 'Edit Transport, Rp 10.000',
    }).length,
  ).toBeGreaterThan(0);
  await press('Return to today');
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 25.000' })
      .length,
  ).toBeGreaterThan(0);
});

test('an expense editor saves a changed amount and category', async () => {
  await press('Edit Food, Rp 25.000');
  await act(async () => {
    screen.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Amount in rupiah')!
      .props.onChangeText('18000');
  });
  await act(async () => {
    screen.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Category')!
      .props.onChangeText('Dating');
  });
  const saveButton = screen.root.findAll(
    node =>
      node.props.onPress &&
      node.findAllByProps({ children: 'Save changes' }).length > 0,
  )[0];
  await act(async () => {
    await saveButton.props.onPress();
  });
  expect(save).toHaveBeenCalledWith('one', {
    amount: 18000,
    category: 'Dating',
    date: props.expenses[0].date,
    type: 'expense',
    note: '',
  });
});

test('an expense editor saves a changed category to Income with type: income', async () => {
  await press('Edit Food, Rp 25.000');
  await act(async () => {
    screen.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Category')!
      .props.onChangeText('Income');
  });
  const saveButton = screen.root.findAll(
    node =>
      node.props.onPress &&
      node.findAllByProps({ children: 'Save changes' }).length > 0,
  )[0];
  await act(async () => {
    await saveButton.props.onPress();
  });
  expect(save).toHaveBeenCalledWith('one', {
    amount: 25000,
    category: 'Income',
    date: props.expenses[0].date,
    type: 'income',
    note: '',
  });
});

test('an expense editor deletes an expense with modal confirmation', async () => {
  await press('Edit Food, Rp 25.000');
  await press('Delete expense');
  // In-modal confirmation prompt is displayed
  expect(
    screen.root.findAllByProps({ children: 'Delete this transaction?' }).length,
  ).toBeGreaterThan(0);
  await press('Confirm delete expense');
  expect(deleteMock).toHaveBeenCalledWith('one');
});

test('tapping review with jarvis triggers onStartDailyReview', async () => {
  await press('Review with Jarvis');
  expect(startReviewMock).toHaveBeenCalledTimes(1);
});

test('allows entering and saving a custom note in expense editor', async () => {
  await press('Edit Food, Rp 25.000');
  await act(async () => {
    screen.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Expense note')!
      .props.onChangeText('Lunch meeting with client');
  });
  const saveButton = screen.root.findAll(
    node =>
      node.props.onPress &&
      node.findAllByProps({ children: 'Save changes' }).length > 0,
  )[0];
  await act(async () => {
    await saveButton.props.onPress();
  });
  expect(save).toHaveBeenCalledWith('one', {
    amount: 25000,
    category: 'Food',
    date: props.expenses[0].date,
    type: 'expense',
    note: 'Lunch meeting with client',
  });
});

test('displays custom note on expense card when present', async () => {
  const propsWithNote: DashboardScreenProps = {
    ...props,
    expenses: [
      {
        ...props.expenses[0],
        note: 'Team coffee break',
      },
      props.expenses[1],
    ],
  };
  await act(async () => {
    screen.update(<DashboardScreen {...propsWithNote} />);
  });

  expect(
    screen.root.findAllByProps({ children: 'Team coffee break' }).length,
  ).toBeGreaterThan(0);
});

test('a loading state does not represent unavailable spending as zero', async () => {
  await act(async () =>
    screen.update(<DashboardScreen {...props} dataStatus="loading" />),
  );
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 25.000' }),
  ).toHaveLength(0);
});

test('renders income with positive prefix, received indicator, and actual spend on day and week recap', async () => {
  const propsWithIncome: DashboardScreenProps = {
    ...props,
    expenses: [
      ...props.expenses,
      {
        id: 'inc-1',
        amount: 68000,
        merchant: '***ANI ***RIA **BR',
        category: 'Income',
        bank: 'BCA',
        type: 'income',
        date: new Date(2026, 8, 10, 12, 40).toISOString(),
      },
    ],
  };
  await act(async () => {
    screen.update(<DashboardScreen {...propsWithIncome} />);
  });

  expect(
    screen.root.findAllByProps({
      accessibilityLabel: 'Edit Income, +Rp 68.000',
    }).length,
  ).toBeGreaterThan(0);

  expect(
    screen.root.findAllByProps({
      children: 'Received: +Rp 68.000',
    }).length,
  ).toBeGreaterThan(0);

  // Today (2026-09-10): spent 25.000, income 68.000 -> spend minus earn = -43.000 (net saved 43.000)
  expect(
    screen.root.findAllByProps({
      children: 'Net saved: +Rp 43.000',
    }).length,
  ).toBeGreaterThan(0);

  // Week recap: spent (25.000 + 10.000) = 35.000, income 68.000 -> actual spend = -33.000
  expect(
    screen.root.findAllByProps({
      children: 'Rp 35.000 spent · +Rp 68.000 earned',
    }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.root.findAllByProps({
      children: '-Rp 33.000',
    }).length,
  ).toBeGreaterThan(0);
});


test('settings panel provides battery settings navigation and listener re-connect trigger', async () => {
  const openSettingsSpy = jest
    .spyOn(Linking, 'openSettings')
    .mockImplementation(() => Promise.resolve());
  const rebindSpy = jest.fn().mockResolvedValue(true);
  NativeModules.NotificationManagerModule = { rebindListener: rebindSpy };

  await press('Open settings');

  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Battery settings' }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Re-connect listener' })
      .length,
  ).toBeGreaterThan(0);

  await press('Battery settings');
  expect(openSettingsSpy).toHaveBeenCalledTimes(1);

  await press('Re-connect listener');
  expect(rebindSpy).toHaveBeenCalledTimes(1);

  openSettingsSpy.mockRestore();
});

test('permission modal provides button to open battery settings', async () => {
  const openSettingsSpy = jest
    .spyOn(Linking, 'openSettings')
    .mockImplementation(() => Promise.resolve());

  await act(async () => {
    screen.update(<DashboardScreen {...props} showNotifModal={true} />);
  });

  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Open battery settings' })
      .length,
  ).toBeGreaterThan(0);

  await press('Open battery settings');
  expect(openSettingsSpy).toHaveBeenCalledTimes(1);

  openSettingsSpy.mockRestore();
});

const textOf = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(textOf).join('')
    : typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : '';
const visibleText = () =>
  screen.root.findAllByType(Text).map(node => textOf(node.props.children));
const byTestId = (testID: string) =>
  screen.root.findAll(node => node.props.testID === testID)[0];
// 10 Sep 2026 (system time) is a Thursday; 1 Sep 2026 is a Tuesday.
const withAugust = [
  ...props.expenses,
  {
    id: 'aug-early',
    amount: 20000,
    category: 'Food',
    merchant: 'Cafe',
    bank: 'BCA',
    date: new Date(2026, 7, 5, 12).toISOString(),
  },
  {
    id: 'aug-late',
    amount: 99000,
    category: 'Food',
    merchant: 'Cafe',
    bank: 'BCA',
    date: new Date(2026, 7, 25, 12).toISOString(),
  },
];

test('the month card compares spending so far with the same days of last month', async () => {
  await act(async () => {
    screen.update(<DashboardScreen {...props} expenses={withAugust} />);
  });

  expect(visibleText()).toEqual(
    expect.arrayContaining([
      'SEPTEMBER SO FAR',
      'Rp 35.000',
      '↑ 75% vs 1–10 Aug',
      'Highest day · Thu 10 Sept · Rp 25.000',
    ]),
  );
  expect(byTestId('month-recap-card').props.accessibilityLabel).toBe(
    'September so far, Rp 35.000, up 75% versus 1–10 Aug. Open month recap',
  );
});

test('the month recap sheet shows peaks and categories, browses months, and jumps to a day', async () => {
  await act(async () => {
    screen.update(<DashboardScreen {...props} expenses={withAugust} />);
  });
  await act(async () => byTestId('month-recap-card').props.onPress());

  expect(visibleText()).toEqual(
    expect.arrayContaining([
      'September 2026',
      'Highest day',
      'Thu 10 Sept',
      'Highest week',
      '7–10 Sept',
      'Food',
      'Transport',
      '71%',
      '29%',
    ]),
  );
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Next month' })[0].props
      .accessibilityState,
  ).toMatchObject({ disabled: true });

  await press('Previous month');
  expect(visibleText()).toEqual(
    expect.arrayContaining([
      'August 2026',
      'Rp 119.000',
      'Nothing recorded in July',
      '24–30 Aug',
    ]),
  );
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Previous month' })[0]
      .props.accessibilityState,
  ).toMatchObject({ disabled: true });

  await press('View highest day, Tue 25 Aug');
  expect(visibleText()).not.toContain('Highest week');
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 99.000' })
      .length,
  ).toBeGreaterThan(0);
});

test('the month card waits for spending data before showing totals', async () => {
  await act(async () => {
    screen.update(<DashboardScreen {...props} dataStatus="loading" />);
  });

  expect(byTestId('month-recap-card').props.disabled).toBe(true);
  expect(visibleText()).not.toContain('Rp 35.000');
});
