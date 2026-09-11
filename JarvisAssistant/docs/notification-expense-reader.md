# Notification Expense Reader

Jarvis listens for Android status bar notifications through
`react-native-android-notification-listener`. The native listener service starts a React Native
Headless JS task named `RNAndroidNotificationListenerHeadlessJs`, so `index.js` must register that
exact task key.

References:

- React Native Headless JS Android: https://reactnative.dev/docs/headless-js-android
- Android `NotificationListenerService`: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- `react-native-android-notification-listener` usage: https://github.com/leandrosimoes/react-native-android-notification-listener

## Data Flow

1. Android posts a notification.
2. `com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener` receives it when the
   user has granted Notification Access.
3. The listener serializes public notification fields such as `app`, `title`, `text`, `bigText`,
   `subText`, `summaryText`, `extraInfoText`, `groupedMessages`, and `time`.
4. `headlessTask.js` parses only Financial Diary/myBCA spending notifications locally.
5. Parsed expenses are saved under `users/jarvis_user_id/expenses` with a locally generated
   document ID.
6. `App.tsx` subscribes to the same collection, calculates dashboard totals, and exposes category
   edits for each saved expense.

## Privacy Rule

Bank notification extraction must stay local. Do not send the raw notification text to an AI model or
third-party API just to extract amount, category, merchant, or bank. Store the minimum useful
structured data: amount, category, merchant, bank, source app/title, date, and notification time.

## Headless Runtime Rule

React Native headless tasks do not get a separate entry file. Any runtime polyfills needed by
headless-only imports must be loaded before those imports. `headlessTask.js` and `index.js` both load
`react-native-get-random-values` before `uuid`, because `uuid` needs `crypto.getRandomValues` in a
React Native runtime. Without this, the listener can receive the notification but fail before
Firestore writes the expense.

## Matching Rule

The parser only accepts notifications whose title looks like `Financial Diary` or `my financial`.
The amount must be written with an `IDR` or `Rp` prefix. The parser supports common Indonesian and
international formatting examples:

- `IDR 250,580.00` -> `250580`
- `IDR 250.580,00` -> `250580`
- `IDR 42.500` -> `42500`

If Android leaves `text` empty, the parser checks richer fields such as `bigText` and grouped
messages before giving up.

## Transaction Type and Category Rules

The parser classifies notifications as either an **expense** or **income**:

- **Expense Notifications (`You spent...` / `Anda mengeluarkan...`)**:
  - Example: `You spent IDR 376,000.00 at Food & Beverage.`
  - The text after `at` or `di` is saved as the category (e.g. `Food & Beverage`).
  - Saved with `type: "expense"`, `category: "Food & Beverage"`, and `merchant: "Food & Beverage"`.
  - Increments daily and weekly spending totals.

- **Income Notifications (`You received...` / `Anda menerima...`)**:
  - Example: `You received IDR 68,000.00 from ***ANI ***RIA **BR at Account Transfer ...`
  - The sender is extracted from between `from`/`dari` and `at`/`di` (e.g. `***ANI ***RIA **BR`).
  - Saved with `type: "income"`, `category: "Income"`, and `merchant: sender || channel || "Income"`.
  - Rendered with positive prefix `+Rp ...` and emerald styling.
  - Displayed in a summary indicator (`Received: +Rp ...`) and reported in spoken daily voice recaps without inflating spending totals.

The dashboard always includes the default categories `Income` and `Dating`, merges them with categories already seen
in saved transactions, and lets the user update categories at any time. Unknown or blank categories are normalized to `Uncategorized`. Existing documents without a `type` field default to `"expense"`.

## Date Rule

The dashboard accepts either the explicit ISO `date` field saved by the headless task or Firestore
timestamp-style fields from `createdAt`. This keeps older expenses visible even when Firestore returns
timestamps as `{ seconds, nanoseconds }` instead of objects with `toDate()`.

## Device Checks

After installing a build with notification-listener changes, open Android Settings and re-enable
Notification Access for Jarvis. Some Android builds keep the old listener component until access is
toggled off and back on.

## Daily dashboard and corrections (2026-09-10)

The redesigned dashboard groups timestamps using the phone's current timezone. The date
selector, weekly chart, and `get_daily_recap` handler share `buildDayReport`. Calendar
boundaries use local calendar constructors rather than adding 24 hours, so daylight-saving
transitions do not lose late-night spending. Today refreshes while the app is open and on
returning to the foreground. Changing the phone timezone can move an expense to another day.

New records use the notification's posting timestamp when valid and not in the future;
otherwise they use capture time. The installed listener's `RNNotification.java` serializes
`StatusBarNotification.getPostTime()` as an epoch-millisecond string. `dateSource` is either
`notification` or `capture`. Posting time is a proxy, not proof of transaction time. Existing
records retain their dates, including the existing `createdAt` fallback.

An edit updates amount, category, and optional corrected date on the same document. Amounts
must be positive whole rupiah values. `originalAmount` and `originalCategory` retain the first
captured values; `updatedAt` is a server timestamp. No collection migration or history rewrite
is required. Existing unknown document fields are preserved by `updateDoc`.

Snapshot metadata distinguishes cached records and pending changes from server-confirmed
updates. The editor can be closed while a write is pending. If that write later fails, the
app retains an error banner with Retry and Dismiss actions outside the editor. Spoken recaps
qualify cached/pending totals and do not report zero when loading or unavailable. Updating
expense data replaces tool handlers without recreating the active voice service.

Raw notification payload and parsed financial-value debug logs have been removed from the
headless task. The existing notification matching and native listener behavior are retained.

References:

- [Android notification posting time](https://developer.android.com/reference/android/service/notification/StatusBarNotification#getPostTime())
- [React Native Firebase snapshots and updates](https://rnfirebase.io/firestore/usage)
- [Firestore server timestamps](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp)

Live database inspection was unavailable during this update because Firebase CLI credentials
had expired. No database instance, rules, or indexes were changed. The existing default
Firestore connection and document APIs are retained. Verify correction permissions and sync
behavior on the signed-in phone before treating the release as device-verified.
