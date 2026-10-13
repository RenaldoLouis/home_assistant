# Transaction Types: Expense, Income, Investment

Every record in `users/{uid}/expenses` has a `type`. The type decides which
total the amount lands in. Only `expense` is spending.

| Type | Counts as spending | Shown as | Effect on actual spend |
|---|---|---|---|
| `expense` | Yes | `Rp 25.000` (dark) | Adds to it |
| `income` | No | `+Rp 68.000` (green), `Received: +Rp …` | Subtracts from it (`netSpend = spent − received`) |
| `investment` | No | `Rp 300.000` (slate `Colors.invest`), `Invested: Rp …` | **None** — money moved into stocks, mutual funds, gold or crypto is saved, not spent |

Records with a missing or unknown `type` count as `expense`
(`transactionTypeOf` in `src/expenses/transactionTypes.ts`).

## Classification rules (`src/expenses/transactionTypes.ts`)

One pure module owns the category ↔ type rules. The expense editor, Jarvis's
`update_expense` tool, the Firestore reader (`toEditableExpense` in
`App.tsx`) and `buildExpenseUpdate` all use it.

- **Paired categories**: `Income` ↔ `income`, `Investment` ↔ `investment`
  (case-insensitive). A paired category always wins: a record whose category is
  `Investment` is an investment.
- **Picking a category** (`reclassify(current, { category })`): a paired
  category sets its type, and any other category sets `expense`.
- **Switching type** (`reclassify(current, { type })`): if the current category
  is paired with a different type, it is swapped for the new type's pair (or
  `Uncategorized` for expense). An `Uncategorized` record takes the new type's
  pair. Any other category the user chose (e.g. `Gold`) is kept.
- **Jarvis**: `update_expense` accepts `type: "expense" | "income" |
  "investment"` (case-insensitive). Any other value is rejected with a spoken
  reason, and nothing is written.

## Where investments appear

| Surface | Behaviour |
|---|---|
| Day summary | Total excludes investments. `N invested` joins the count line, and an `Invested: Rp …` badge sits beside the income badges. |
| Week | Bars, day dots and the week total are spending only. The breakdown line lists `Rp … invested`. |
| Month card | `Invested · Rp …` line under the highest day. |
| Month recap sheet | `Rp … invested · N investments` line. Investments are excluded from the total, daily average, chart, highest day and week, top categories and the month-over-month comparison. |
| Expense list | Trend icon, slate amount, no sign. |
| Jarvis | Daily recap, today's context and `get_monthly_recap` (`invested`, `investmentCount`) report investments separately. The system instruction tells Jarvis never to add them to spending. |

## Notifications

Bank notifications are never auto-classified as investments (user decision,
Oct 13 2026). Mark them in the editor's type switcher, or tell Jarvis. To add
auto-detection later, start from real investment notification texts, not
guessed patterns. Notifications containing `earning` (e.g. RDN earnings) are
still dropped entirely by the parser.

## Firestore rules

`firestore.rules` allows `type in ['expense', 'income', 'investment']`. The repo
has no `firebase.json`, so publish rule changes manually in the Firebase Console.
Until the live rules include `investment`, saving an investment fails with
`permission-denied`.
