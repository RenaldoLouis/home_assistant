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

  it('parses received notifications as income with sender and category Income', () => {
    expect(
      parseExpenseNotification({
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You received IDR 68,000.00 from ***ANI ***RIA **BR at Account Transfer ...',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 68000,
        category: 'Income',
        merchant: '***ANI ***RIA **BR',
        type: 'income',
        bank: 'BCA',
      }),
    );
  });

  it('parses all real received notification variations from myBCA', () => {
    expect(
      parseExpenseNotification({
        app: 'com.bca.mybca.omni.android',
        title: 'Financial Diary',
        text: 'You received IDR 106,000.00 from ****ARA RAMA***NI at Account Transfer...',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 106000,
        category: 'Income',
        merchant: '****ARA RAMA***NI',
        type: 'income',
      }),
    );

    expect(
      parseExpenseNotification({
        app: 'com.bca.mybca.omni.android',
        title: 'Financial Diary',
        text: 'You received IDR 53,000.00 from **NDA ***ANA **AIR at Account Transfe...',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 53000,
        category: 'Income',
        merchant: '**NDA ***ANA **AIR',
        type: 'income',
      }),
    );
  });

  it('parses spending notifications explicitly with type expense', () => {
    expect(
      parseExpenseNotification({
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 376,000.00 at Food & Beverage.',
      }),
    ).toEqual(
      expect.objectContaining({
        amount: 376000,
        category: 'Food & Beverage',
        merchant: 'Food & Beverage',
        type: 'expense',
      }),
    );
  });
});
