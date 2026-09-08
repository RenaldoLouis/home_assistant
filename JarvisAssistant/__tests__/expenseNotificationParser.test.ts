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
});
