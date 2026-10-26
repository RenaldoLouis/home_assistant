# Jarvis Assistant — Production Release & Progress Roadmap

> **Status Tracker & Living Milestone Document**  
> **Last Updated**: October 26, 2026  
> **Target Release**: Google Play Store (Android Bare Workflow)  
> **Design Philosophy**: Warm Linen & Botanical Editorial ([docs/design-system.md](design-system.md))

---

## 1. Release Roadmap Overview

```
[Phase 1: App Icon Overhaul] ➔ COMPLETED ✅
         │
[Phase 2: Google Sign-In & Multi-Tenant Firestore] ➔ COMPLETED ✅
         │
[Phase 3: Notification Privacy & Security Hardening] ➔ COMPLETED ✅
         │
[Phase 4: Play Store Packaging & Data Safety] ➔ NEXT / UPCOMING 🟡
         │
[Phase 5: Future Couple Sharing & Subscription] ➔ ROADMAP ⚪
```

---

## 2. Milestone Details & Status

### Phase 1: App Icon & Brand Overhaul
**Status**: `COMPLETED` ✅ (September 14, 2026)  
- [x] **App Logo Concept**: Designed luxury editorial brand emblem — 4-point organic spark of clarity in soft sage mint (`#E4EFE8`), warm linen ivory (`#F5F4F0`), and delicate gold outline on deep botanical forest teal (`#166359` / `#176B61`).
- [x] **Store Asset**: Created 512×512 Google Play Store graphic (`android/app/src/main/res/drawable/app_logo.png`).
- [x] **Adaptive Android Icons**: Generated and deployed square squircle (`ic_launcher.png`), round (`ic_launcher_round.png`), and adaptive foreground (`ic_launcher_foreground.png`) across all mipmap resolutions (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`), with 45.5% emblem scaling to ensure 100% safe-zone margin.
- [x] **XML Configuration**: Configured `ic_launcher.xml` and `ic_launcher_round.xml` with botanical teal `#166359` in `values/colors.xml`.
- [x] **Device Verification**: Verified adaptive rendering on physical Samsung Galaxy S24 FE.

---

### Phase 2: Google Sign-In & Multi-Tenant Firestore Architecture
**Status**: `COMPLETED` ✅ (September 14, 2026)  
- [x] **Firebase Auth SDK**: Integrated `@react-native-firebase/auth@26.1.0` (Modular API) and `@react-native-google-signin/google-signin`.
- [x] **Auth State Management**: Created [`AuthContext.tsx`](../src/auth/AuthContext.tsx) and [`authService.ts`](../src/auth/authService.ts) supporting Google Sign-In, Guest (Anonymous) Mode, and sign-out.
- [x] **Multi-Tenant Scoped Firestore**:
  - Migrated collection path from root `/expenses` to `/users/{userId}/expenses`.
  - Injected `userId` and `ledgerId` into both foreground sync (`App.tsx`) and background headless listener (`headlessTask.js`).
  - ~~Offline fallback for guest sessions~~: guest mode skipped Firebase sign-in and wrote to a shared `users/jarvis_user_id` folder. Replaced on October 14, 2026 by real anonymous sign-in (see Fix: Guest Mode & Google Sign-In).
- [x] **Firestore Security Rules**: Authored [`firestore.rules`](../../firestore.rules) enforcing `isOwner(userId)` (`request.auth.uid == userId`) and prepared structure for `/households/{householdId}`.
- [x] **Warm Linen & Botanical Editorial Design Compliance**:
  - Completely restyled [`LoginScreen.tsx`](../src/auth/LoginScreen.tsx) with warm linen background (`#F5F4F0`), serif typography, white card (`#FFFFFF`), sage mint badges (`#E4EFE8`), and accessible 48dp buttons.
  - Aligned Dashboard Profile Chip and Account & Security Settings Card to soft sage palette.
  - Added bottom navigation safe clearance (44dp padding).
- [x] **SHA-1 Fingerprints** (registered in Firebase only on October 14, 2026, together with the `com.jarvisassistant` Android app):
  - Release SHA-1 (`jarvis.keystore`): `10:F3:66:FB:66:58:BC:2D:DE:39:82:34:94:D6:E5:94:51:A9:3B:D6`
  - Debug SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- [x] **Automated Tests**: 14 test suites, 87 unit tests passing with zero TypeScript errors (`npx tsc --noEmit`).
- [x] **Wireless Physical Installation**: Installed `app-release.apk` (78MB) to Samsung Galaxy S24 FE via ADB over Wi-Fi.

---

### Phase 3: Notification Privacy & Security Hardening
**Status**: `COMPLETED` ✅ (September 14, 2026)  
**Objective**: Build bank-grade local processing privacy guarantees to satisfy strict Google Play Store policies and protect user data.
- [x] **Android Package Whitelist**:
  - Restrict `RNAndroidNotificationListener` parsing exclusively to verified banking and fintech package IDs (`WHITELISTED_BANK_APPS`: BCA, Mandiri, BRI, BNI, CIMB, Jago, Jenius, Permata, GoPay, Dana, OVO, ShopeePay).
  - Immediately drop notifications from personal chat apps (WhatsApp, Telegram, Signal, SMS, Messages, Email, Social Media).
- [x] **OTP & Sensitive Keyword Kill-Switch**:
  - Immediate abort if notification text or title contains sensitive credentials: `OTP`, `kode verifikasi`, `password`, `PIN`, `CVV`, `rahasia`, `jangan beritahu siapapun`.
  - Instant memory wipe — never attempt to extract or store financial records from security challenge texts.
- [x] **RAM-Only On-Device Parsing Guarantee**:
  - Guarantee raw notification string is never written to disk, SQLite, MMKV, or Firestore.
  - Only clean, minimal extracted transaction records (`amount`, `merchant`, `category`, `bank`, `type`, `timestamp`) enter memory.
- [x] **In-App Privacy Transparency Center**:
  - Built [`PrivacyTransparencyModal.tsx`](../src/components/PrivacyTransparencyModal.tsx) adhering to Warm Linen & Botanical Editorial styling.
  - Interactive whitelist viewer allowing users to inspect supported packages.
  - Integrated into Settings sheet with 100% On-Device Data Safety badge.
- [x] **Unit & Regression Testing**:
  - Added comprehensive test coverage in `__tests__/expenseNotificationParser.test.ts` and `__tests__/PrivacyTransparencyModal.test.tsx` (15 suites, 93 unit tests, 100% green).

---

### Feature: Monthly Spending Recap
**Status**: `COMPLETED` ✅ (branch `feature/monthly-recap`, pending device verification)  
- [x] Month card on Today + Month recap sheet (total, same-period comparison, daily chart, highest day/week, top categories, month browsing).
- [x] Jarvis voice tool `get_monthly_recap`.
- [x] Unit + screen tests (16 suites, 110 tests). Details: [monthly-recap.md](monthly-recap.md).
- [ ] Verify chart and card layout on the Samsung Galaxy S24 FE release build.

---

### Feature: Investment Transaction Type
**Status**: `MERGED` to `main` (October 13, 2026) — rules published; included in the release builds installed on the S24 FE on October 14 and October 26, 2026
- [x] Third type `investment` alongside expense and income; `Investment` default category paired with it, like Income
- [x] Kept out of spending everywhere: day/week totals, bars, month total, daily average, peaks, categories, month-over-month comparison
- [x] Own totals: day badge, week breakdown, month card and sheet, Jarvis daily/monthly recaps and context
- [x] Editor type switcher (Expense / Income / Investment); `update_expense` accepts `type: "investment"`
- [x] Publish updated `firestore.rules` in the Firebase Console (project `boba-todo-list`, Oct 13, 2026)
- [ ] Verify on the S24 FE
- Details: [transaction-types.md](transaction-types.md)

---

### Fix: Guest Mode & Google Sign-In
**Status**: `MERGED` ✅ (branch `fix/guest-anonymous-auth` → `main`, October 14, 2026)
- [x] Root cause of "Couldn't load expenses": guest mode never signed in to Firebase, so its reads of the shared `users/jarvis_user_id` folder had no `request.auth` and the rules refused them (`403 PERMISSION_DENIED`).
- [x] Guest mode is a real Firebase anonymous account; the shared folder and `JARVIS_USER_ID` are gone. The background notification reader skips saving when nobody is signed in.
- [x] A guest upgrades to Google in place (`linkWithCredential`, same UID, data kept). A Google account that already has its own data is refused with a message; the guest stays signed in. Guests get no Sign Out (it would strand their data).
- [x] Google sign-in: registered the `com.jarvisassistant` Android app with both SHA-1s in Firebase, installed its `google-services.json`, and passed the web client ID (`GOOGLE_WEB_CLIENT_ID` in `.env`).
- [x] Installed on the S24 FE (arm64 release, wireless ADB) and signed in without errors.
- [x] Copied the 159 old guest expenses into the user's Google account (0 failed, 0 missing), then deleted the old `users/jarvis_user_id` folder after checking the copy.
- [ ] Confirm the next real BCA "Financial Diary" notification saves to the dashboard. The listener and reader were checked on the phone; a real bank notification can't be faked.

Details: [auth-and-guest-mode.md](auth-and-guest-mode.md).

---

### Fix: Duplicate Notification Expenses
**Status**: `MERGED` ✅ (branch `codex/fix-notification-duplicates` → `main`, October 26, 2026)
- [x] Root cause: every delivery of a bank notification got a new random ID, so a notification delivered twice (or twice at the same moment) saved two expenses.
- [x] The reader derives a stable ID (UUID v5) from the scrubbed notification fields and saves with create-if-absent, so a repeat never adds a second expense or overwrites the user's edits.
- [x] Captures wait in an on-device queue (SQLite in app-private `noBackupFilesDir`, scrubbed fields only) until the server confirms the save, so an offline capture syncs after reconnecting.
- [x] Tests: 17 suites, 161 tests; TypeScript clean (October 18, 2026).
- [x] Installed on the S24 FE (arm64 release, wireless ADB, October 26, 2026); the app opened without errors.
- [ ] Confirm on the phone: a real bank notification saves once, and an offline capture appears after reconnecting.

Details: [notification-expense-reader.md](notification-expense-reader.md).

---

### Fix: Voice Reply Latency
**Status**: `MERGED` ✅ (branch `perf/voice-latency` → `main`, October 6, 2026; pending device check)  
- [x] Measured 5–15 s from end of speech to first audio. Causes: the 2.5 native-audio model thinks before speaking, and the default end-of-speech detection is slow under noise.
- [x] Switched to `gemini-3.1-flash-live-preview` and tuned end-of-speech detection (high sensitivity, 500 ms of silence). Measured 1.0–1.2 s with room noise.
- [x] Replaced the deprecated `realtimeInput.mediaChunks` with `realtimeInput.audio`.
- [x] Installed on the S24 FE (arm64 release APK over wireless ADB, October 6, 2026).
- [x] Confirmed on the S24 FE by the user: replies are much faster.
- [x] Fixed Jarvis cutting off its own reply on the loudspeaker (echo). The mic sends silence while the reply plays, plus 300 ms (merged to `main`, October 6, 2026).
- [x] Echo fix installed on the S24 FE (included in the October 14 and October 26, 2026 release builds).
- [ ] Confirm replies no longer get cut off on the loudspeaker.
- [ ] Move to `gemini-3.8-live` once it stops returning `1011 Internal error`. Details: [voice-latency.md](voice-latency.md).

---

### Phase 4: Google Play Store App Management & Compliance
**Status**: `UPCOMING` ⚪  
- [ ] **Production Android App Bundle (AAB)**:
  - Generate release AAB via `./gradlew bundleRelease` for Google Play distribution.
- [ ] **Keystore & Signing Verification**:
  - Confirm `jarvis.keystore` production configuration in `android/app/build.gradle`.
- [ ] **Play Store Policy Disclosures**:
  - Prepare Google Play declaration for `BIND_NOTIFICATION_LISTENER_SERVICE` (Financial expense tracking core functionality).
  - Draft Google Play Data Safety form responses:
    - Financial Info: Processed locally, stored in user-isolated Firestore.
    - Personal Info / SMS: Not collected, not shared.
- [ ] **Store Listing Preparation**:
  - Editorial description emphasizing privacy-first native Android architecture.
  - High-resolution screenshots showcasing Warm Linen UI and Gemini Voice Companion.

---

### Phase 5: Future Roadmap (Post-Launch)
**Status**: `BACKLOG` ⚪  
- [ ] **Prolink Lamp Voice Control (parked)**:
  - Voice tool, validation and Tuya data-point mapping are built on branch `feature/lamp-local-control`.
  - Waiting on the decision to move the bulb from mEzee to Smart Life, which is needed to read its local key. Plan: control it over the LAN only, then block its internet access. See `docs/lamp-local-control.md` on that branch.
- [ ] **Couple / Household Spending Mode**:
  - Shared ledger under `/households/{householdId}/expenses`.
  - Invitation codes and permission delegation.
- [ ] **Premium Subscription Model**:
  - Advanced multi-member ledger, automated tax summaries, and enhanced Gemini voice interaction quotas.

---

## 3. Design System & Code Quality Standards

All work across all phases must adhere to:
1. **Design System**: [docs/design-system.md](design-system.md) (**Warm Linen & Botanical Editorial**). No dark obsidian or neon elements.
2. **Architecture Documentation**: [docs/architecture-and-system-overview.md](architecture-and-system-overview.md).
3. **Notification Technical Guide**: [docs/notification-expense-reader.md](notification-expense-reader.md).
4. **Wifi Debugging Guide**: [docs/wifi-debugging-guide.md](wifi-debugging-guide.md).
5. **Living Log & Core Rules**: [`agents.md`](../../agents.md).
