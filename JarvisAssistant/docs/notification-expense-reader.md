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

## Category Rule

For Financial Diary/myBCA spending alerts, the text after `at` or `di` is saved as both the initial
category and merchant label. For example, `You spent IDR 250,580.00 at Food & Beverage.` is saved with
`category: "Food & Beverage"`.

The dashboard always includes the default category `Dating`, merges it with categories already seen
in saved expenses, and lets the user update an expense category at the end of the day. Unknown or
blank categories are normalized to `Uncategorized`.

## Date Rule

The dashboard accepts either the explicit ISO `date` field saved by the headless task or Firestore
timestamp-style fields from `createdAt`. This keeps older expenses visible even when Firestore returns
timestamps as `{ seconds, nanoseconds }` instead of objects with `toDate()`.

## Device Checks

After installing a build with notification-listener changes, open Android Settings and re-enable
Notification Access for Jarvis. Some Android builds keep the old listener component until access is
toggled off and back on.
