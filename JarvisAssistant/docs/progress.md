# Jarvis Assistant — Production Release & Progress Roadmap

> **Status Tracker & Living Milestone Document**  
> **Last Updated**: September 14, 2026  
> **Target Release**: Google Play Store (Android Bare Workflow)  
> **Design Philosophy**: Warm Linen & Botanical Editorial ([docs/design-system.md](design-system.md))

---

## 1. Release Roadmap Overview

```
[Phase 1: App Icon Overhaul] ➔ COMPLETED ✅
         │
[Phase 2: Google Sign-In & Multi-Tenant Firestore] ➔ COMPLETED ✅
         │
[Phase 3: Notification Privacy & Security Hardening] ➔ NEXT / IN-PROGRESS 🟡
         │
[Phase 4: Play Store Packaging & Data Safety] ➔ UPCOMING ⚪
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
  - Implemented offline-first persistence fallback for unauthenticated/guest sessions.
- [x] **Firestore Security Rules**: Authored [`firestore.rules`](../../firestore.rules) enforcing `isOwner(userId)` (`request.auth.uid == userId`) and prepared structure for `/households/{householdId}`.
- [x] **Warm Linen & Botanical Editorial Design Compliance**:
  - Completely restyled [`LoginScreen.tsx`](../src/auth/LoginScreen.tsx) with warm linen background (`#F5F4F0`), serif typography, white card (`#FFFFFF`), sage mint badges (`#E4EFE8`), and accessible 48dp buttons.
  - Aligned Dashboard Profile Chip and Account & Security Settings Card to soft sage palette.
  - Added bottom navigation safe clearance (44dp padding).
- [x] **SHA-1 Fingerprints Registered**:
  - Release SHA-1 (`jarvis.keystore`): `10:F3:66:FB:66:58:BC:2D:DE:39:82:34:94:D6:E5:94:51:A9:3B:D6`
  - Debug SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- [x] **Automated Tests**: 14 test suites, 87 unit tests passing with zero TypeScript errors (`npx tsc --noEmit`).
- [x] **Wireless Physical Installation**: Installed `app-release.apk` (78MB) to Samsung Galaxy S24 FE via ADB over Wi-Fi.

---

### Phase 3: Notification Privacy & Security Hardening
**Status**: `IN PROGRESS` 🟡  
**Objective**: Build bank-grade local processing privacy guarantees to satisfy strict Google Play Store policies and protect user data.
- [ ] **Android Package Whitelist**:
  - Restrict `RNAndroidNotificationListener` parsing exclusively to verified banking and fintech package IDs (e.g., `com.bca`, `id.co.bankmandiri.livin`, `id.co.bri.brimo`, `id.co.bni.papamobile`, `com.gojek.app`, `id.dana`).
  - Immediately drop notifications from personal chat apps (WhatsApp, Telegram, SMS, Email).
- [ ] **OTP & Sensitive Keyword Kill-Switch**:
  - Immediate abort if notification text contains sensitive credentials: `OTP`, `kode verifikasi`, `password`, `PIN`, `CVV`, `rahasia`.
  - Instant memory wipe — never attempt to extract or store financial records from security challenge texts.
- [ ] **RAM-Only On-Device Parsing Guarantee**:
  - Guarantee raw notification string is never written to disk, SQLite, MMKV, or Firestore.
  - Only clean, extracted transaction records (`amount`, `merchant`, `category`, `timestamp`) enter memory.
- [ ] **In-App Privacy Transparency Center**:
  - Design a dedicated transparency bottom sheet / modal in the Warm Linen Editorial style.
  - Explicitly explain to the user:
    1. What is read (only whitelist bank expense alerts).
    2. What is discarded (personal messages, OTPs, balance notices).
    3. Where processing happens (100% locally on the phone CPU).
    4. Cloud sync boundaries (only scrubbed transaction amounts sync to user's private Firestore).
- [ ] **Unit & Regression Testing**:
  - Add comprehensive test coverage in `__tests__/expenseNotificationParser.test.ts` for whitelist filtering, OTP discard, and malicious payload rejection.

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
