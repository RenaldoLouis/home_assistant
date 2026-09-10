# Jarvis daily dashboard redesign

Status: proposal, 2026-09-10. Navigation and reporting timezone await the user's decision.
This document records the design review; no application or Firebase data has been changed.

## Product intent

Jarvis is a voice-accessible home assistant that tracks spending and is intended to control
lights and Bluetooth speaker/music playback. The supplied screenshot is a visual reference:
its health goals, streaks, and lesson content are not requirements for Jarvis.

## Proposed experience

Use a warm off-white background, white rounded cards, soft shadows, dark readable text,
serif section headings, and restrained teal, coral, and category accents. Keep Android
system navigation and safe areas. Use locally available fonts and existing dependencies.

| Before | Proposed after | Why |
| --- | --- | --- |
| Large orb and notes precede expenses | Compact Jarvis header and circular week date selector | Make daily spending immediately reachable |
| Current totals and chart in one dense card | Prominent selected-day total, then compact weekly bars | Give the amount priority and retain comparison |
| All recent expenses with category choices inline | Selected-day expense cards; tap to edit amount and category | Reduce clutter and support corrections |
| Voice button scrolls with the dashboard | Persistent Ask Jarvis control opening a voice panel | Keep the assistant available throughout |
| Capability text implies device support | Separate Home controls with verified availability | Communicate what can actually be used |

The week selector shows weekday and date, a clear selected outline, and an optional activity
dot. Week arrows and a date picker allow older history; a Today action returns to the
current day. Avoid partially filled budget rings without an actual budget feature.

Selecting a date changes its total and expense list. The chart shows that selected week's
daily totals, highlights the selected day, and allows tapping another day. Distinguish
This week, This month, and rolling periods precisely.

Expense cards show category icon/name, amount, available merchant/bank context, and time.
Do not invent merchant names: the current parser often uses a category label as merchant.
The editor has explicit Save and Cancel, amount validation, category selection, pending
save feedback, and retryable errors. Proposed date correction handles delayed alerts.

Recommended navigation: Today for daily spending, Home for device controls, plus persistent
Ask Jarvis. Settings contains notification access and setup. Existing notes are not part of
the user's stated feature priorities; decide their placement during the visual review.

## Verified local implementation

- `headlessTask.js` writes one expense document with amount, merchant, category, bank, ISO
  `date`, server `createdAt`, and optional `notificationTime`.
- `date` currently means headless processing time, not necessarily transaction time.
- `App.tsx` reads the full expense collection and supports legacy timestamp shapes.
- Category changes are persisted; there is no amount editing callback yet.
- `expenseSummary.ts` calculates today, calendar week, and a period starting 30 days before
  today. The screen's 7 Days and 30 Days labels do not precisely describe those windows.
- The daily voice recap handler ignores the optional requested date and returns today's total.
- Lamp and music handlers in `App.tsx` currently log and return success without hardware calls.
- Notification/parser/native files have pre-existing uncommitted changes; preserve them.

These are source-code findings. Live Firestore records, deployed rules, and phone behavior
were not inspected in this review. The user reports notification capture now works.

## Data approach

Keep the existing expense collection and document identities. A database rebuild is not
needed for date selection. Resolve one reporting date per expense and use one shared
aggregation path for cards, charts, and voice recaps.

For new records, distinguish spending time from ingestion time. Prefer a trustworthy
transaction timestamp when available, otherwise a validated notification timestamp,
otherwise capture time. Record which fallback was used; notification time is only a proxy
for transaction time. Verify the native timestamp format before changing the writer.

Keep `createdAt` as a server timestamp and add `updatedAt` to corrections. Preserve the
original captured amount/category when adding correction support. Update the existing
document rather than creating a second expense. Keep raw notification parsing local.

Continue accepting legacy `date` and `createdAt` formats. Do not guess historical transaction
dates or mass-rewrite records. A derived YYYY-MM-DD reporting key may help queries later,
but is not necessary merely to render a week selector. Any later range-query transition
must keep older records visible while timestamp fields are standardized.

The reporting timezone is a product decision. Recommended: Asia/Jakarta, so historical day
totals remain stable when the phone changes timezone. Explicit voice requests such as
“today” use the actual current day; browsing an older date must not change their meaning.

## Acceptance checks for implementation

1. A late notification crossing midnight follows the documented timestamp fallback.
2. Old ISO dates and Firestore timestamp objects remain visible on the correct day.
3. Editing an amount/category updates the card, day total, weekly chart, and spoken recap.
4. Failed or offline saves never falsely claim confirmed synchronization.
5. Empty days, loading, and unavailable data have distinct states.
6. Midnight rollover and explicit dated voice requests use the chosen reporting timezone.
7. Date controls and editing work with large text and TalkBack; touch targets are at least
   48 dp. Reduced motion removes translation/scale, and day switching stays immediate.
8. Verify notification capture, voice continuity, and visual layout in a release build on
   the user's phone. Device control success requires actual integration evidence.

## Official references

- [Firestore writes and server timestamps](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp): server timestamps track server receipt, not spending time.
- [Firestore query operators](https://firebase.google.com/docs/firestore/query-data/queries#query_operators): range filters support bounded history queries after consistent date storage is established.
- [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility): 48 dp touch targets and accessible alternatives to gesture-only actions.
