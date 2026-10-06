# Monthly Spending Recap

A month-level view of spending: the month's total, how it compares with the
previous month, which day and which week cost the most, the daily spread, and
the top categories. Available on the Today screen and through Jarvis voice.

## Where it lives

| Surface | What it shows |
|---|---|
| **Month card** (Today tab, under the weekly chart) | Month of the *selected day* — "OCTOBER SO FAR" (in progress) or "AUGUST 2026" (complete) — with total, trend badge, and highest day. Disabled with `—` while data is loading or unavailable. Tap opens the sheet. |
| **Month recap sheet** | `‹ Month YYYY ›` navigation, total, trend badge, daily average, full-previous-month context, income/net line, daily bar chart, Highest day / Highest week rows, top 5 categories. |
| **Jarvis voice** (`get_monthly_recap`) | Same numbers as a plain JSON summary Gemini can speak from. |

Tapping **Highest day** or **Highest week** closes the sheet and selects that
day (or the week's first day) on the Today tab, so the user can see the
transactions behind the peak.

Month navigation is bounded: back to the month of the earliest recorded
expense, forward to the current month.

## Calculation rules (`src/expenses/monthRecap.ts`)

`buildMonthRecap(expenses, month, now)` is a pure function over the expenses
already held in memory (the Firestore subscription in `App.tsx` loads the
user's full ledger). No new reads, writes, packages, or permissions.

- **Timezone**: calendar boundaries follow the phone's current timezone, like
  the rest of the app (`src/expenses/dates.ts`).
- **Spending vs income**: totals are gross spending (`type !== 'income'`).
  Income is reported separately as `incomeTotal` and `netSpend`.
- **Period**: a month in progress counts day 1 through today. Future-dated
  records inside the month are excluded until their day arrives.
- **Comparison — same period**: while a month is in progress it is compared
  with days 1…N of the previous month, where N = days elapsed, clamped to the
  previous month's length (30 March compares with all 28 days of February).
  A completed month compares with the whole previous month. The full previous
  month total is also exposed as context (`previousMonthTotal`).
  `changeRatio` is `null` when the previous period had no spending.
- **Weeks**: Monday–Sunday (same rule as the weekly strip), clipped at the
  month boundaries and at today. Week totals always sum to the month total.
  Edge weeks are shorter; the UI labels them "partial week" or "so far".
- **Peaks**: highest positive total; ties resolve to the earliest day/week.
  `null` when nothing was spent.
- **Categories**: grouped by `normalizeExpenseCategory` (trimmed, blank →
  `Uncategorized`), sorted by total then name, with `share` of the month.

## Voice tool

`get_monthly_recap({ month?: 'YYYY-MM' })` — defaults to the current month.
The handler in `App.tsx` validates the month with `parseMonth`, returns an
`error` while data is loading/unavailable, and adds a `note` when answering
from cached or pending records.

`summarizeMonthRecap` sends **aggregates only**: totals, date-keyed peaks and
week ranges, and the top 5 category names with totals. No merchants, banks,
notes, or expense IDs leave the device through this tool. It is only sent to
Gemini when the user asks a monthly question during a voice session.

The system instruction (`buildJarvisSystemInstruction`) tells Jarvis to use
this tool for month totals, month-over-month comparisons, and highest day or
week questions, and to mention the same-period basis when comparing.

## Design notes

- Follows the Warm Linen & Botanical Editorial system: white card with
  `#EBECE5` border, mint/teal accents, serif sheet title.
- Trend badge tone: spending up → warm amber (`Colors.warning` on `#F7EFE3`),
  down → green (`#1B8755` on `#E8F6EE`), flat/none → neutral.
- No new animation: the card and rows reuse `AnimatedPressable` press feedback;
  the sheet reuses `Sheet`. Month switching is instant (occasional action, no
  spatial relationship to convey).
- Daily bars are decorative and non-interactive (31 bars cannot meet the 44pt
  touch target); the chart exposes one accessibility summary instead. The
  peak rows are the interactive path to a day.
- Labels use `toLocaleDateString('en-GB')` like the rest of the dashboard
  (current CLDR renders September as "Sept").

## Tests

- `__tests__/monthRecap.test.ts` — period boundaries, same-period comparison,
  short-month clamping, completed-month comparison, clipped weeks, peaks and
  ties, empty/future months, categories, the voice summary, month keys.
- `__tests__/DashboardScreen.test.tsx` — card copy and accessibility label,
  sheet content, month navigation bounds, jump to highest day, loading state.
- `__tests__/JarvisToolExecutor.test.ts`, `__tests__/App.test.tsx`,
  `__tests__/GeminiLiveService.test.ts` — tool declaration, dispatch, handler
  output and validation, system instruction.
