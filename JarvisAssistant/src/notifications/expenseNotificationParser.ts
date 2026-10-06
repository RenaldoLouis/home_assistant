import {
  UNCATEGORIZED_EXPENSE_CATEGORY,
  normalizeExpenseCategory,
} from '../expenses/categories';
import { TransactionType } from '../expenses/types';

interface NotificationPayload {
  [key: string]: unknown;
  app?: unknown;
  title?: unknown;
  titleBig?: unknown;
  text?: unknown;
  bigText?: unknown;
  subText?: unknown;
  summaryText?: unknown;
  extraInfoText?: unknown;
  groupedMessages?: unknown;
  time?: unknown;
}

export interface ParsedExpenseNotification {
  amount: number;
  merchant: string;
  category: string;
  bank: string;
  type: TransactionType;
  notificationTime?: string;
  sourceApp: string;
  sourceTitle: string;
}

const TEXT_FIELD_ORDER = [
  'bigText',
  'text',
  'subText',
  'summaryText',
  'extraInfoText',
  'android.bigText',
  'android.text',
  'android.subText',
  'android.summaryText',
  'android.infoText',
];

export interface WhitelistedAppInfo {
  packageName: string;
  name: string;
  category: 'bank' | 'ewallet';
}

export const WHITELISTED_BANK_APPS: WhitelistedAppInfo[] = [
  // BCA
  { packageName: 'com.bca', name: 'BCA', category: 'bank' },
  { packageName: 'id.co.bca', name: 'BCA', category: 'bank' },
  { packageName: 'id.co.bca.mybca', name: 'BCA', category: 'bank' },
  { packageName: 'com.bca.mybca.omni.android', name: 'BCA', category: 'bank' },
  // Mandiri
  { packageName: 'id.co.bankmandiri.livin', name: 'Mandiri', category: 'bank' },
  { packageName: 'id.co.mandiri.livin', name: 'Mandiri', category: 'bank' },
  { packageName: 'com.bankmandiri.mandirionline', name: 'Mandiri', category: 'bank' },
  // BRI
  { packageName: 'id.co.bri.brimo', name: 'BRI', category: 'bank' },
  // BNI
  { packageName: 'id.co.bni.papamobile', name: 'BNI', category: 'bank' },
  { packageName: 'src.com.bni', name: 'BNI', category: 'bank' },
  // CIMB Niaga
  { packageName: 'id.co.cimbniaga.octomobile', name: 'CIMB Niaga', category: 'bank' },
  // Bank Jago
  { packageName: 'com.jago.app', name: 'Bank Jago', category: 'bank' },
  // Jenius / BTPN
  { packageName: 'com.btpn.dc', name: 'Jenius', category: 'bank' },
  { packageName: 'com.btpn.jenius', name: 'Jenius', category: 'bank' },
  // Permata
  { packageName: 'id.co.permatabank.mobile', name: 'PermataBank', category: 'bank' },
  // GoPay / Gojek
  { packageName: 'com.gojek.app', name: 'GoPay', category: 'ewallet' },
  { packageName: 'com.gopay.wallet', name: 'GoPay', category: 'ewallet' },
  // Dana
  { packageName: 'id.dana', name: 'Dana', category: 'ewallet' },
  // OVO
  { packageName: 'id.ovo.app', name: 'OVO', category: 'ewallet' },
  // ShopeePay
  { packageName: 'com.shopee.id', name: 'ShopeePay', category: 'ewallet' },
];

const BLOCKED_PACKAGES_PATTERN =
  /\b(?:whatsapp|telegram|signal|securesms|messaging|mms|sms|instagram|facebook|twitter|threads|tiktok|gmail|mail|outlook)\b/i;

export const SENSITIVE_SECURITY_PATTERN =
  /\b(?:otp|one[- ]time\s+password|kode\s+verifikasi|verification\s+code|kata\s+sandi|password|pin|cvv|cvc|rahasia|security\s+code|auth\s+code|jangan\s+beritahu\s+siapapun|jangan\s+berikan\s+kode|do\s+not\s+share)\b/i;

const TARGET_TITLE_PATTERN = /\b(?:financial\s+diary|my\s+financial)\b/i;
const IDR_AMOUNT_PATTERN = /\b(?:IDR|Rp\.?)\s*([0-9][0-9.,]*)/i;
const EARNING_PATTERN = /\b(?:rdn\s+earning|earning)\b/i;
const INCOME_PATTERN = /\b(?:you\s+received|anda\s+menerima|received|menerima)\b/i;

export function isWhitelistedApp(sourceApp: string): boolean {
  if (!sourceApp) {
    return false;
  }
  const normalized = sourceApp.trim().toLowerCase();

  // Instant block on chat, SMS, social, and email packages
  if (BLOCKED_PACKAGES_PATTERN.test(normalized)) {
    return false;
  }

  return WHITELISTED_BANK_APPS.some(
    app =>
      normalized === app.packageName.toLowerCase() ||
      normalized.startsWith(app.packageName.toLowerCase() + '.') ||
      normalized.includes(app.packageName.toLowerCase()),
  );
}

export function containsSensitiveCredentials(text: string): boolean {
  if (!text) {
    return false;
  }
  return SENSITIVE_SECURITY_PATTERN.test(text);
}

export function parseExpenseNotification(
  rawNotification: unknown,
): ParsedExpenseNotification | null {
  const payload = parsePayload(rawNotification);

  if (!payload) {
    return null;
  }

  const sourceApp = toText(payload.app);
  const sourceTitle = firstText(payload.title, payload.titleBig, payload['android.title']);
  const notificationText = resolveNotificationText(payload);

  // 1. Strict Whitelist Check: Reject non-banking and chat apps immediately
  if (!isWhitelistedApp(sourceApp)) {
    return null;
  }

  // 2. Candidate Title Check: Must be a financial tracking notification
  if (!isFinancialDiaryCandidate(sourceApp, sourceTitle)) {
    return null;
  }

  // 3. Sensitive Security Kill-Switch: Immediate abort if OTP/PIN/Password is present
  if (
    containsSensitiveCredentials(notificationText) ||
    containsSensitiveCredentials(sourceTitle)
  ) {
    return null;
  }

  // 4. Exclude investment earnings
  if (EARNING_PATTERN.test(notificationText)) {
    return null;
  }

  const amount = extractIdrAmount(notificationText);

  if (amount === null) {
    return null;
  }

  const isIncome = INCOME_PATTERN.test(notificationText);
  const type: TransactionType = isIncome ? 'income' : 'expense';

  if (isIncome) {
    const sender = extractSender(notificationText);
    const channel = extractCategory(notificationText);
    const merchant =
      sender ||
      (channel !== UNCATEGORIZED_EXPENSE_CATEGORY ? channel : 'Unknown');

    return {
      amount,
      merchant,
      category: 'Income',
      bank: inferBank(sourceApp, sourceTitle),
      type,
      notificationTime: toText(payload.time) || undefined,
      sourceApp,
      sourceTitle,
    };
  }

  const category = extractCategory(notificationText);

  return {
    amount,
    merchant: category === UNCATEGORIZED_EXPENSE_CATEGORY ? 'Unknown' : category,
    category,
    bank: inferBank(sourceApp, sourceTitle),
    type,
    notificationTime: toText(payload.time) || undefined,
    sourceApp,
    sourceTitle,
  };
}

export function resolveNotificationText(payload: NotificationPayload): string {
  const candidates = TEXT_FIELD_ORDER.flatMap(field => collectText(payload[field]));
  const groupedMessages = Array.isArray(payload.groupedMessages)
    ? payload.groupedMessages.flatMap(message => {
        if (!message || typeof message !== 'object') {
          return [];
        }

        const grouped = message as { title?: unknown; text?: unknown };
        return [toText(grouped.text), toText(grouped.title)];
      })
    : [];

  const allCandidates = [...candidates, ...groupedMessages]
    .map(value => value.trim())
    .filter(Boolean);

  return (
    allCandidates.find(candidate => IDR_AMOUNT_PATTERN.test(candidate)) ??
    allCandidates.sort((first, second) => second.length - first.length)[0] ??
    ''
  );
}

export function extractIdrAmount(text: string): number | null {
  const amountMatch = text.match(IDR_AMOUNT_PATTERN);

  if (!amountMatch) {
    return null;
  }

  return parseIdrAmount(amountMatch[1]);
}

export function parseIdrAmount(value: string): number | null {
  const numericValue = value.replace(/[^\d.,]/g, '');

  if (!numericValue) {
    return null;
  }

  const separators = numericValue.match(/[.,]/g) ?? [];
  let normalized = numericValue;

  if (separators.length > 0) {
    const lastSeparatorIndex = Math.max(
      numericValue.lastIndexOf('.'),
      numericValue.lastIndexOf(','),
    );
    const fractionalPart = numericValue.slice(lastSeparatorIndex + 1);
    const integerPart = numericValue.slice(0, lastSeparatorIndex);
    const hasMixedSeparators = numericValue.includes('.') && numericValue.includes(',');

    if (hasMixedSeparators && fractionalPart.length === 2) {
      normalized = integerPart.replace(/[.,]/g, '');
    } else if (!hasMixedSeparators && separators.length === 1 && fractionalPart === '00') {
      normalized = integerPart;
    } else {
      normalized = numericValue.replace(/[.,]/g, '');
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parsePayload(rawNotification: unknown): NotificationPayload | null {
  if (typeof rawNotification === 'string') {
    try {
      const parsed = JSON.parse(rawNotification);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(rawNotification) ? rawNotification : null;
}

function collectText(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }

  const text = toText(value);
  return text ? [text] : [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = toText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function isFinancialDiaryCandidate(_sourceApp: string, sourceTitle: string): boolean {
  return TARGET_TITLE_PATTERN.test(sourceTitle);
}

function inferBank(sourceApp: string, sourceTitle: string): string {
  const normalizedApp = sourceApp.trim().toLowerCase();
  const matchedApp = WHITELISTED_BANK_APPS.find(
    app =>
      normalizedApp === app.packageName.toLowerCase() ||
      normalizedApp.startsWith(app.packageName.toLowerCase() + '.') ||
      normalizedApp.includes(app.packageName.toLowerCase()),
  );

  if (matchedApp) {
    return matchedApp.name;
  }

  const appAndTitle = `${sourceApp} ${sourceTitle}`.toLowerCase();
  if (appAndTitle.includes('bca')) return 'BCA';
  if (appAndTitle.includes('mandiri')) return 'Mandiri';
  if (appAndTitle.includes('bni')) return 'BNI';
  if (appAndTitle.includes('bri')) return 'BRI';
  if (appAndTitle.includes('cimb')) return 'CIMB Niaga';
  if (appAndTitle.includes('jago')) return 'Bank Jago';
  if (appAndTitle.includes('jenius')) return 'Jenius';
  if (appAndTitle.includes('gojek') || appAndTitle.includes('gopay')) return 'GoPay';
  if (appAndTitle.includes('dana')) return 'Dana';
  if (appAndTitle.includes('ovo')) return 'OVO';
  if (appAndTitle.includes('shopee')) return 'ShopeePay';

  if (TARGET_TITLE_PATTERN.test(sourceTitle)) {
    return 'BCA';
  }

  return 'Unknown';
}

function extractSender(text: string): string | null {
  const match = text.match(/\b(?:from|dari)\s+(.+?)(?:\s+(?:at|di)\b|[.!?]|$)/i);
  const sender = match?.[1]?.trim().replace(/[.,;:]+$/, '');
  return sender || null;
}

function extractCategory(text: string): string {
  const categoryMatch = text.match(/\b(?:at|di)\s+(.+?)(?:[.!?]|$)/i);
  const category = categoryMatch?.[1]?.trim().replace(/[.,;:]+$/, '');

  return normalizeExpenseCategory(category);
}

function isRecord(value: unknown): value is NotificationPayload {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
