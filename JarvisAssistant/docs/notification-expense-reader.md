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
5. Scrubbed captures are first saved to an account-scoped, app-private Android SQLite queue.
   When online, a Firestore transaction creates `users/{uid}/expenses/{stableId}` only if absent,
   then removes the pending entry. Nothing is captured while nobody is signed in.
6. `App.tsx` subscribes to the same collection, calculates dashboard totals, and exposes category
   edits for each saved expense.

## Privacy & Security Architecture (Phase 3 Hardening)

Jarvis implements bank-grade privacy protections designed for Google Play Data Safety compliance:

1. **Strict Banking Package Whitelist (`isWhitelistedApp`)**:
   - Notifications are filtered exclusively against official banking and fintech package IDs (`WHITELISTED_BANK_APPS` in `expenseNotificationParser.ts`):
     - Banks: BCA (`id.co.bca.mybca`, `com.bca`), Mandiri (`id.co.bankmandiri.livin`), BRI (`id.co.bri.brimo`), BNI (`id.co.bni.papamobile`), CIMB Niaga (`id.co.cimbniaga.octomobile`), Bank Jago (`com.jago.app`), Jenius (`com.btpn.dc`), Permata (`id.co.permatabank.mobile`).
     - Fintech E-Wallets: GoPay (`com.gojek.app`), Dana (`id.dana`), OVO (`id.ovo.app`), ShopeePay (`com.shopee.id`).
   - Personal chat, SMS, social media, and email packages (`com.whatsapp`, `org.telegram.messenger`, `org.thoughtcrime.securesms`, `com.google.android.apps.messaging`, `com.instagram.android`, `com.google.android.gm`, etc.) are **immediately dropped** without inspecting their contents.

2. **Automated OTP & Credential Kill-Switch (`containsSensitiveCredentials`)**:
   - Notifications containing sensitive verification terms (`OTP`, `kode verifikasi`, `pin`, `password`, `cvv`, `kode rahasia`, `security code`, `jangan beritahu siapapun`, `do not share`) trigger an immediate kill-switch.
   - The notification is dropped from memory instantly; no transaction extraction is attempted.

3. **RAM-Only Local Processing Guarantee**:
   - Notification text is parsed 100% on the device CPU using deterministic regex in JavaScript.
   - Raw notification strings and message bodies **never leave the phone** and are never saved to SQLite, MMKV, AsyncStorage, or cloud servers.
   - Only clean, minimal structured data (amount, category, merchant, bank, type, timestamp) is synced to `/users/{userId}/expenses`.
   - The same scrubbed fields can remain in the app-private pending queue while offline; no raw notification body is queued. The queue lives in `noBackupFilesDir` so Android backups exclude it.

4. **In-App Privacy Transparency Center**:
   - Accessible via Settings > **Privacy & Transparency Center** (`PrivacyTransparencyModal.tsx`).
   - Renders in the Warm Linen & Botanical Editorial theme, allowing users to inspect the active package whitelist and data safety boundaries directly on their phone.

## Headless Runtime Rule

React Native headless tasks do not get a separate entry file. Any runtime polyfills needed by
headless-only imports must be loaded before those imports. `headlessTask.js` and `index.js` both load
`react-native-get-random-values` before `uuid`, because `uuid` needs `crypto.getRandomValues` in a
React Native runtime. Without this, the listener can receive the notification but fail before
Firestore writes the expense.

## Duplicate delivery protection (2026-10-18)

The listener can deliver a notification more than once. Previously every invocation generated
a random UUID, so each delivery could insert another expense. A notification with a positive,
safe epoch-millisecond posting time now uses a UUID v5 derived locally from its source package,
posting time, parsed amount, merchant, and transaction type. This uses the existing `uuid`
dependency; raw notification text is never stored or sent for identification.

`notificationExpenseStore.ts` first queues the scrubbed capture through
`NotificationManagerModule`. `PendingNotificationExpenses.kt` uses Android's built-in
SQLite APIs with a `(user_id, expense_id)` primary key and `INSERT OR IGNORE`, so duplicate
deliveries cannot replace the first pending capture. Disk work runs on a dedicated executor.
The database is inside app-private `noBackupFilesDir`, excluded from Android backup, and the
native bridge rejects payloads with fields outside the scrubbed schema. No new packages are used.

An account-scoped in-flight promise coalesces queue drains. Each entry is reconciled with a
Firestore transaction: read the stable document, create it only when absent, and remove the
local entry only after the transaction succeeds. This preserves corrections even when the
phone has no cached copy, and concurrent clients retry rather than overwrite an existing
expense. A crash after server commit but before local removal is safe: the replay finds the
document and clears the pending entry. Transactions fail offline; the durable local capture
remains for retry, without queueing an unconditional remote overwrite. No rules changes are
required. Different posting times, amounts, merchants, types, or source packages produce
separate identities; matching amounts alone never suppress a transaction.

The headless task attempts a drain after enqueue. `App.tsx` also drains when an expense
snapshot reaches the server, including after reconnection or app restart. There is no new
background scheduler: if Jarvis is closed when connectivity returns, reconciliation waits
for the next app open or accepted notification. Offline captures appear on the dashboard
after reconciliation. A queued account is processed only while that same UID is signed in;
signing out retains its captures privately for its next sign-in. Clearing app data/uninstalling
removes unsynced captures. Install a new Android binary for the queue bridge; JS-only updates
to older binaries cannot capture notifications safely.

Missing/invalid posting times retain random IDs rather than risking suppression of unrelated
purchases. The installed native listener always supplies `getPostTime()`; it does not expose
Android's notification key. Two genuinely separate notifications with identical parsed fields
and the exact same posting millisecond cannot be distinguished by this identity. Reposts with
a different posting time are separate captures. Existing documents with random IDs and
historical duplicates are not migrated or deleted by this fix.

Regression coverage is in `__tests__/headlessTask.test.js`: simultaneous/repeated delivery,
JS restart with saved corrections, separate purchases, account isolation, failed-write retry,
offline cache miss without overwriting corrections, and recovery of offline captures after
restart/account switch. `App.test.tsx` verifies server reconnection triggers reconciliation.
Physical-device notification delivery, queue durability, and offline sync still require
verification on an installed build.

References:

- [Android notification posting time](https://developer.android.com/reference/android/service/notification/StatusBarNotification#getPostTime())
- [UUID v5 API](https://github.com/uuidjs/uuid#uuidv5name-namespace-buffer-offset)
- [Firestore offline persistence and last-write-wins behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore transaction limitations](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Android SQLite APIs](https://developer.android.com/training/data-storage/sqlite)
- [Android backup exclusions for noBackupFilesDir](https://developer.android.com/identity/data/autobackup#Files)

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

Notifications are never classified as `investment`; the user marks investments in the editor or through Jarvis
([transaction-types.md](transaction-types.md)).

The dashboard always includes the default categories `Income`, `Investment` and `Dating`, merges them with categories already seen
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
