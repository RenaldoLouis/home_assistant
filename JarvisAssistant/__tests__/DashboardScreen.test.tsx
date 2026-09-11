import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  DashboardScreen,
  DashboardScreenProps,
} from '../src/screens/DashboardScreen';
import { Linking, NativeModules, TextInput } from 'react-native';

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
  categoryOptions: ['Food', 'Transport', 'Dating'],
  dataStatus: 'synced',
  setShowNotifModal: jest.fn(),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  onExpenseSave: save,
  onRequestNotifPermission: jest.fn(),
  onRetry: jest.fn(),
  dailyNotes: '',
  setDailyNotes: jest.fn(),
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
  });
});

test('a loading state does not represent unavailable spending as zero', async () => {
  await act(async () =>
    screen.update(<DashboardScreen {...props} dataStatus="loading" />),
  );
  expect(
    screen.root.findAllByProps({ accessibilityLabel: 'Edit Food, Rp 25.000' }),
  ).toHaveLength(0);
});

test('renders income with positive prefix and shows received indicator on summary', async () => {
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
