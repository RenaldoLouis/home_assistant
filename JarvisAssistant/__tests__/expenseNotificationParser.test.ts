import { parseExpenseNotification } from '../src/notifications/expenseNotificationParser';

describe('expense notification parser', () => {
  it('extracts the Financial Diary category from the notification body', () => {
    expect(
      parseExpenseNotification({
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 250,580.00 at Food & Beverage.',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 250580,
        category: 'Food & Beverage',
      }),
    );
  });

  it('extracts spending from real myBCA notification', () => {
    expect(
      parseExpenseNotification({
        app: 'com.bca.mybca.omni.android',
        title: 'Financial Diary',
        text: 'You spent IDR 5,000.00 at Account Transfer.',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 5000,
        category: 'Account Transfer',
        bank: 'BCA',
      }),
    );
  });

  it('ignores RDN earning notifications', () => {
    expect(
      parseExpenseNotification({
        app: 'com.bca.mybca.omni.android',
        title: 'Financial Diary',
        text: 'RDN earning of IDR 5,000.00 at Account Transfer category.',
      }),
    ).toBeNull();
  });
});
