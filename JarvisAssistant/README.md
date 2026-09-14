# Project Jarvis — Personal AI Assistant & Financial Companion

**Project Jarvis** is an Android-first personal smart assistant and real-time financial tracking companion. It automates expense tracking directly from bank notifications and features a real-time conversational voice assistant powered by Google Gemini Live.

---

## Key Features

- **Automated Financial Diary (Zero Data Leak)**:
  - Captures and parses status bar notifications (e.g. BCA, Mandiri) completely on-device in background via Android Headless JS.
  - No third-party OCR or cloud parsers—raw notification content never leaves your phone.
- **Smart Spending Dashboard**:
  - Live weekly spending chart with daily breakdowns and date navigation.
  - Distinct handling of **Expenses** and **Income (+)** with actual net spend tracking.
  - In-modal expense editor with Category-to-Type synchronization and safe deletion with confirmation modals.
- **Gemini Live Multimodal Voice Assistant**:
  - Direct low-latency two-way voice conversation over WebSocket using custom native PCM 16kHz/24kHz audio bridges.
  - Interactive **End-of-Day 1-by-1 Spending Review**: Jarvis walks you line-by-line through today's transactions, updating categories and notes in Firestore in real time.
  - Function calling tools: `update_expense`, `delete_expense`, `get_daily_expenses`, `get_daily_recap`, and `play_music` (Spotify launch).

---

## Documentation

Comprehensive engineering guides are available in the [`docs/`](./docs) directory:

- [**Architecture & System Overview**](./docs/architecture-and-system-overview.md): High-level system architecture, data flow diagrams, subsystem breakdowns, and directory maps.
- [**Notification Expense Reader**](./docs/notification-expense-reader.md): Headless JS task, notification listener service, and regex parser specifications.
- [**Wi-Fi Debugging Guide**](./docs/wifi-debugging-guide.md): Connecting and debugging directly on Android devices over ADB Wi-Fi.
- [**UI/UX Redesign & Validation**](./docs/ui-ux-redesign-validation.md): UI standards, touch targets (≥ 48dp), and device test matrices.
- [**Project Rules & Agent Memory (`agents.md`)**](../agents.md): Core coding rules, privacy requirements, and the chronological living implementation log.

---

## Getting Started

### Prerequisites
- Node.js (v18+) & npm
- Android Studio & Android SDK (API 34+)
- A Google Gemini API key (for Gemini Live) configured in `.env`:
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  GEMINI_LIVE_MODEL=gemini-2.0-flash-exp
  GEMINI_LIVE_VOICE=Puck
  ```

### Development Commands
```bash
# 1. Install dependencies
npm install

# 2. Start Metro Bundler
npm start

# 3. Build & Run on Connected Android Device
npm run android

# 4. Run Test Suite (Jest)
npm test

# 5. Run TypeScript Type Check
npx tsc --noEmit

# 6. Run ESLint
npm run lint
```
