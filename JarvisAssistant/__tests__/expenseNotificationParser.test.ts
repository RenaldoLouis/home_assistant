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

  describe('privacy & security hardening', () => {
    it('immediately rejects messaging, social, and untrusted packages even if title matches Financial Diary', () => {
      const untrustedApps = [
        'com.whatsapp',
        'org.telegram.messenger',
        'org.thoughtcrime.securesms', // Signal
        'com.google.android.apps.messaging',
        'com.samsung.android.messaging',
        'com.instagram.android',
        'com.facebook.katana',
        'com.random.untrusted.app',
      ];

      for (const app of untrustedApps) {
        expect(
          parseExpenseNotification({
            app,
            title: 'Financial Diary',
            text: 'You spent IDR 100,000.00 at Secret Merchant.',
          }),
        ).toBeNull();
      }
    });

    it('triggers OTP & verification code kill-switch and immediately aborts', () => {
      const sensitiveNotifications = [
        {
          app: 'id.co.bca.mybca',
          title: 'Financial Diary',
          text: 'Kode OTP Anda adalah 849201 untuk transaksi IDR 150,000.00 di Merchant. JANGAN BERIKAN KODE INI.',
        },
        {
          app: 'id.co.bca.mybca',
          title: 'Financial Diary',
          text: 'Your verification code is 492014 for authorization IDR 250,000.00. Do not share.',
        },
        {
          app: 'id.co.bca.mybca',
          title: 'Security Alert',
          text: 'Masukkan PIN atau kata sandi untuk tagihan IDR 500,000.00.',
        },
        {
          app: 'id.co.bca.mybca',
          title: 'Financial Diary',
          text: 'CVV 392 is required for payment IDR 75,000.00.',
        },
        {
          app: 'id.co.bca.mybca',
          title: 'Financial Diary',
          text: 'Rahasia: One-Time Password 982341 for IDR 300,000.00.',
        },
      ];

      for (const notif of sensitiveNotifications) {
        expect(parseExpenseNotification(notif)).toBeNull();
      }
    });

    it('accepts all official whitelisted Indonesian banks and fintech e-wallets', () => {
      const whitelistedApps = [
        { app: 'com.bca', bank: 'BCA' },
        { app: 'id.co.bca.mybca', bank: 'BCA' },
        { app: 'com.bca.mybca.omni.android', bank: 'BCA' },
        { app: 'id.co.bankmandiri.livin', bank: 'Mandiri' },
        { app: 'id.co.bri.brimo', bank: 'BRI' },
        { app: 'id.co.bni.papamobile', bank: 'BNI' },
        { app: 'id.co.cimbniaga.octomobile', bank: 'CIMB Niaga' },
        { app: 'com.jago.app', bank: 'Bank Jago' },
        { app: 'com.btpn.dc', bank: 'Jenius' },
        { app: 'com.gojek.app', bank: 'GoPay' },
        { app: 'id.dana', bank: 'Dana' },
        { app: 'id.ovo.app', bank: 'OVO' },
        { app: 'com.shopee.id', bank: 'ShopeePay' },
      ];

      for (const { app, bank } of whitelistedApps) {
        const parsed = parseExpenseNotification({
          app,
          title: 'Financial Diary',
          text: 'You spent IDR 25,000.00 at Coffee Shop.',
        });

        expect(parsed).not.toBeNull();
        expect(parsed?.amount).toBe(25000);
        expect(parsed?.category).toBe('Coffee Shop');
        expect(parsed?.bank).toBe(bank);
      }
    });

    it('guarantees returned parsed notification contains only scrubbed fields and never leaks raw payload', () => {
      const parsed = parseExpenseNotification({
        app: 'id.co.bca.mybca',
        title: 'Financial Diary',
        text: 'You spent IDR 50,000.00 at Grocery Store.',
        extraPrivateField: 'secret-account-number-12345',
        anotherField: 'private-data',
      });

      expect(parsed).not.toBeNull();
      expect(parsed).not.toHaveProperty('extraPrivateField');
      expect(parsed).not.toHaveProperty('anotherField');
      expect(parsed).not.toHaveProperty('text');
      expect(parsed).toEqual({
        amount: 50000,
        merchant: 'Grocery Store',
        category: 'Grocery Store',
        bank: 'BCA',
        type: 'expense',
        notificationTime: undefined,
        sourceApp: 'id.co.bca.mybca',
        sourceTitle: 'Financial Diary',
      });
    });
  });
});
