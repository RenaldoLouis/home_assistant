import {
  UNCATEGORIZED_EXPENSE_CATEGORY,
  normalizeExpenseCategory,
} from '../expenses/categories';

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

const TARGET_TITLE_PATTERN = /\b(?:financial\s+diary|my\s+financial)\b/i;
const KNOWN_BANK_APP_PATTERN = /\b(?:bca|mybca|mandiri|bni|bri)\b/i;
const IDR_AMOUNT_PATTERN = /\b(?:IDR|Rp\.?)\s*([0-9][0-9.,]*)/i;

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

  if (!isFinancialDiaryCandidate(sourceApp, sourceTitle)) {
    return null;
  }

  const amount = extractIdrAmount(notificationText);

  if (amount === null) {
    return null;
  }

  const category = extractCategory(notificationText);

  return {
    amount,
    merchant: category === UNCATEGORIZED_EXPENSE_CATEGORY ? 'Unknown' : category,
    category,
    bank: inferBank(sourceApp, sourceTitle),
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

function isFinancialDiaryCandidate(sourceApp: string, sourceTitle: string): boolean {
  return (
    TARGET_TITLE_PATTERN.test(sourceTitle) ||
    (KNOWN_BANK_APP_PATTERN.test(sourceApp) && TARGET_TITLE_PATTERN.test(sourceTitle))
  );
}

function inferBank(sourceApp: string, sourceTitle: string): string {
  const appAndTitle = `${sourceApp} ${sourceTitle}`.toLowerCase();

  if (appAndTitle.includes('bca') || TARGET_TITLE_PATTERN.test(sourceTitle)) {
    return 'BCA';
  }

  if (appAndTitle.includes('mandiri')) {
    return 'Mandiri';
  }

  if (appAndTitle.includes('bni')) {
    return 'BNI';
  }

  if (appAndTitle.includes('bri')) {
    return 'BRI';
  }

  return 'Unknown';
}

function extractCategory(text: string): string {
  const categoryMatch = text.match(/\b(?:at|di)\s+(.+?)(?:[.!?]|$)/i);
  const category = categoryMatch?.[1]?.trim().replace(/[.,;:]+$/, '');

  return normalizeExpenseCategory(category);
}

function isRecord(value: unknown): value is NotificationPayload {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
