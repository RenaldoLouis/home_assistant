# Project Jarvis - Personal AI Assistant

## Context
This project is a React Native (Android) application that serves as a DIY personal smart assistant.
The goal is to provide voice-controlled home automation, real-time banking expense tracking, and conversational intelligence using an Android phone, without relying on expensive, proprietary smart home hubs. 

> **Detailed Architecture & Subsystems Documentation**: See [JarvisAssistant/docs/architecture-and-system-overview.md](JarvisAssistant/docs/architecture-and-system-overview.md) for full diagrams, data flow specifications, directory maps, and AI tool execution protocols. 

## Tech Stack
- **Framework**: React Native (Targeting Android exclusively for now, Bare Workflow recommended over Expo for native Bluetooth/Audio control)
- **AI Brain**: Google Gemini API (Free Tier) with Function Calling
- **Wake Word Detection**: Porcupine (Picovoice) for offline "Hi Jarvis" detection
- **Speech-to-Text (STT)**: `@react-native-community/voice` (Android SpeechRecognizer)
- **Text-to-Speech (TTS)**: `react-native-tts`
- **Bluetooth (Media)**: Standard Android Bluetooth APIs (e.g., `react-native-bluetooth-classic`) for JBL Speaker connection
- **Bluetooth (IoT/BLE)**: `react-native-ble-plx` for controlling BLE smart lights.
- **Wi-Fi (IoT)**: Tuya Cloud API / Open API integration for Wi-Fi based smart lights (e.g., Bardi).
- **Animations & UI Polish**: `react-native-reanimated` (for UI-thread performance), `react-native-gesture-handler` (for interruptible physics), and `react-native-haptic-feedback` (for tactile feedback).

## Core Features (MVP)
1. **Always-On Listening (Foreground-Only)**: Detects the wake word "Hi Jarvis" locally while the app is open. No complex background services; will explore adding a homescreen widget for quick access.
2. **Intent Parsing**: Records the user's command, converts it to text, and sends it to the Gemini API.
3. **Function Calling (Tools)**: Gemini responds not just with conversational text, but with structured function calls (e.g., `turn_on_light()`, `play_music()`).
4. **Hardware Control**:
   - **Speaker/Music**: Connect to a paired JBL Bluetooth speaker and launch **Spotify** via Android Intent to start playback.
   - **Lighting**: Support both BLE lights (via GATT characteristics) and Wi-Fi lights (via Tuya API).

## AI Agent Instructions

**Role Persona**: You are a Senior Full Stack Developer assisting with this project. Your code must always be the most secure, efficient, clean, readable, and maintainable.

**Core Rules**:
1. **Strict Privacy & Zero Data Leak**: Prioritize safety above absolutely everything. The app must be 100% safe security-wise and must NEVER leak any personal data from the phone. Minimize the use of third-party libraries; rely on trusted first-party APIs (like standard Android APIs or official Google SDKs) to ensure data never goes to untrusted third parties.
2. **Documentation Driven & Mandatory Living Log**: Every implementation decision must be backed by official documentation. When building a new feature or system, you must proactively create internal documentation for it so the project remains structured and understandable. **MANDATORY**: You must ALWAYS document what was done (features, bugfixes, tool additions, architectural updates) directly in `agents.md` under the **Implementation Log / Context History** at the completion of every task, so you and future agents retain continuous memory and context across sessions.
3. **Android First**: Prioritize Android-specific implementations, as cross-platform compatibility is not a strict requirement.
4. **Gemini API**: Ensure that the Gemini API is implemented using the official `@google/generative-ai` SDK with `tools` (function calling) configured.
5. **Permissions Handling**: When dealing with Bluetooth/BLE, handle Android permissions (`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`) carefully, as Android 12+ requires explicit runtime permissions.
6. **UI Design**: Keep the UI minimal and functional; the primary interaction paradigm is voice. BUT — every visual element must be crafted with care. Minimal does not mean ugly. See the **Design & Animation Discipline** section below.
7. **Senior Developer Standards**: You must develop with absolute accuracy and efficiency like a professional Senior Full Stack Developer. Actively question, verify, and validate every requirement before writing code. Do not blindly accept instructions if they contradict best practices or project rules. Use the provided agent skills (like `tdd`, `grill-me`, and `code-review`) to ensure code quality is top-tier.

---

## Agent Workflow & Skill Integration
This project is equipped with a suite of local agent skills (located in `.agents/skills`). You are expected to actively leverage these skills for optimization and structured workflows:
- **Planning & Design**: Trigger `grill-me` or `grill-with-docs` to relentlessly sharpen architectural decisions and automatically generate ADRs (Architecture Decision Records). Use `domain-modeling` to define ubiquitous terminology.
- **Prototyping & Setup**: Use `prototype` to build throwaway UI/logic tests before committing to an architecture. Ensure `setup-pre-commit` is run initially for code formatting.
- **Implementation**: Follow the `tdd` (Test-Driven Development) skill for writing robust features via the red-green-refactor loop. 
- **Quality Assurance**: Use the `code-review` skill to evaluate changes against project standards and initial specs before finalizing. Use `diagnosing-bugs` for rigorous performance or error troubleshooting.
- **Context Management**: Use `handoff` to serialize current context when pausing work, and `to-tickets` or `to-spec` to break down large plans into actionable units for the issue tracker.
- **Animation & UI Polish**: Use `animate-expo` for mobile animation implementation, `find-animation-opportunities` to audit where motion adds value, `review-animations` to review animation code against a craft bar, and `improve-animations` for prioritized animation audits.

---

# Design & Animation Discipline — MANDATORY

These rules are derived from the project's installed design and animation skills (Emil Kowalski's design engineering philosophy, Apple HIG principles, and the animation vocabulary). They ensure every pixel of this app feels intentional, premium, and physically grounded — even though the UI is minimal.

## 1. Every animation must justify its existence

Before adding any animation, answer two questions. If either answer is "no," do not animate.

### The Frequency Gate
| Frequency | Verdict |
|---|---|
| 100+ times/day (keyboard shortcuts, core navigation, command palette) | **Reject. No animation. Ever.** |
| Tens of times/day (hover, list navigation, frequent toggles) | Reject, or near-imperceptible only (fast, subtle) |
| Occasional (modals, drawers, toasts, settings) | Eligible — standard animation |
| Rare / first-time (onboarding, empty states, success, celebration) | Eligible — this is where the delight budget lives |

### The Purpose Gate
The animation must serve one of these named purposes — "it looks cool" is not on this list:
- **Feedback** — confirming the interface heard the user (press scale, hold-to-confirm fill)
- **Spatial consistency** — showing where something came from or went
- **State indication** — making a state change legible (morphing button, expanding accordion)
- **Preventing a jarring change** — content that teleports or vanishes with no bridge
- **Explanation** — demonstrating how something works (onboarding only)
- **Delight** — allowed *only* at the rare/first-time frequency tier

## 2. Animation properties — non-negotiable rules

- **`transform` and `opacity` only.** They skip layout and paint and run on the GPU. Never animate `width`, `height`, `margin`, `padding`, `top`, `left` — they trigger layout thrashing and jank.
- **Never `scale(0)`.** Start from `scale(0.95–0.97)` + `opacity: 0`. Nothing in the real world appears from nothing.
- **Transform origin at the trigger** for popovers, dropdowns, menus, tooltips. Modals are exempt — they stay centered.
- **In React Native, never `setState` from a gesture or scroll handler.** Use Reanimated shared values + `useAnimatedStyle`. One React render per frame is the single biggest cause of jank.

## 3. Easing — the soul of motion

| Situation | Easing |
|---|---|
| Entering or exiting | `ease-out` |
| Moving / morphing on screen | `ease-in-out` |
| Press / color change | `ease` |
| Constant motion (spinner, progress) | `linear` |
| Default when unsure | `ease-out` |

**Never `ease-in` on UI.** It starts slow, delaying the exact moment the user is watching. `ease-out` at 200ms *feels* faster than `ease-in` at 200ms.

Strong custom curves (built-in CSS easings are too weak):
```
ease-out:    cubic-bezier(0.23, 1, 0.32, 1)
ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
drawer:      cubic-bezier(0.32, 0.72, 0, 1)  // iOS-like
```

## 4. Duration budgets — UI animations stay under 300ms

| Element | Duration |
|---|---|
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers, bottom sheets | 200–500ms |
| Screen transition | Platform default — don't override |

A 180ms dropdown feels more responsive than a 400ms one. If the moment only "works" as a slow, showy animation, it fails the gate.

## 5. Springs for physical motion

Use springs when the motion is drag-with-momentum, an element that should feel alive, a gesture the user can interrupt, or decorative tracking.

```js
// Apple-style — easier to reason about
{ type: "spring", duration: 0.5, bounce: 0.2 }

// Traditional physics — more control
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

- Keep bounce at 0.1–0.3. Reserve bounce for drag-to-dismiss and playful interactions.
- Springs carry velocity through interruptions — making gestures feel seamless when redirected mid-flight.

## 6. Mobile-specific craft (React Native)

- **Feedback on press-in, commit on press-out.** Don't wait for the tap to complete before showing feedback — that latency is what the user perceives.
- **`scale: 0.97` in 100–150ms** on any pressable. Scale takes the label and icons with it, which is what makes it read as physical.
- **44×44pt minimum touch target.** If the visual is smaller, add `hitSlop` — don't grow the visual.
- **`pressRetentionOffset`** so a finger drifting a few pixels doesn't cancel a press the user meant.
- **Transitions, not keyframes, for rapidly-triggered UI** (toasts, toggles). Transitions retarget from the current value; keyframes restart from zero.
- **Exit the way it entered.** A toast that slides in from the bottom leaves through the bottom. Symmetric paths are what make swipe-to-dismiss feel obvious.

## 7. Haptics — the invisible craft

Haptics make the app feel expensive when used sparingly. Used everywhere, users turn them off.

| Moment | Call |
|---|---|
| A value ticks past a step (picker, slider, segmented control) | `Haptics.selectionAsync()` |
| Something snaps home, a sheet detent catches, a drag commits | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` |
| A heavy object lands, a destructive action fires | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` |
| Operation succeeded or failed | `Haptics.notificationAsync(Success / Error)` |

Three absolute rules:
1. **Same frame as the visual.** A haptic that lags its animation reads as a glitch, not feedback.
2. **One per user action.** Never on scroll, never per frame, never on an entrance animation.
3. **Never the only feedback.** Haptics are off system-wide for many users. The visual must stand alone.

## 8. Accessibility — motion is not optional decoration

- **`prefers-reduced-motion: reduce`** — keep opacity/color transitions that aid comprehension, drop translation/scale/parallax/overshoot. Reduced motion means fewer and gentler, not zero.
- **Touch device hover states**: Gate hover animations behind `@media (hover: hover) and (pointer: fine)`. Touch devices trigger hover on tap, causing false positives.
- **Text scales.** Never animate to a hardcoded height. Measure with `onLayout`, or animate a transform instead. `allowFontScaling` is on by default — any height measured at default type size is wrong at 200%.

## 9. Stagger animations for group entrances

When multiple elements enter together, stagger their appearance with 30–80ms delays between items. Stagger is decorative — never block interaction while stagger animations are playing.

## 10. Apple's eight design principles — the compass

These are the names you reason with when making design decisions:

1. **Purpose.** Make with intention; decide what *not* to build. Every feature asks for the user's time, attention, and trust.
2. **Agency.** Keep people in control: offer choices, don't force a path. Back it with forgiveness — easy undo for slips.
3. **Responsibility.** Act in the user's interest. Privacy: ask at the right moment, only for what's needed, transparently.
4. **Familiarity.** Build on what people already know. Use metaphors that are neither too literal nor too abstract. Be consistent: things that look the same must behave the same.
5. **Flexibility.** Design for different contexts, devices, and abilities. Adapt to the platform. Design inclusively.
6. **Simplicity — not minimalism.** Strip the unnecessary so the core purpose shines; burying everything in one place looks minimal but isn't simple.
7. **Craft.** Uncompromising attention to detail builds trust. Nothing is random — every spacing, timing, and alignment value is a deliberate choice you can defend.
8. **Delight.** The result of getting the other seven right, not confetti tacked on top.

## 11. The animation review checklist — never ship violations

| Never | Instead |
|---|---|
| `scale(0)` entrance | `scale(0.95)` + `opacity: 0` |
| `ease-in` on UI element | `ease-out` or strong custom curve |
| UI duration over 300ms without reason | 150–250ms |
| `transform-origin: center` on trigger-anchored popover | Origin at trigger (modals exempt) |
| Animating `width`/`height`/`margin`/`top`/`left` | `transform` / `opacity` |
| `setState` in gesture/scroll handler | Shared value + `useAnimatedStyle` |
| Everything entering at once | 30–80ms stagger |
| Missing `prefers-reduced-motion` | Gentler variant, not zero |
| Keyframes on rapidly-triggered elements | CSS transitions (retarget smoothly) |
| Symmetric enter/exit timing on press-and-release | Slow deliberate phase, snap system response |
| Haptic per frame or as only feedback | One per commit, always paired with visual |
| Judging feel in dev mode | Release build, slowest supported device |

## 12. Process — design and motion together

- **Prototype interactively.** An interactive demo is worth a million static designs. You discover the interface by building and playing with it.
- **Design interaction and visuals together.** Motion is not a layer added after the pixels — "you shouldn't be able to tell where one ends and the other begins."
- **Test on real devices.** For touch interactions (drawers, swipe gestures), test on physical hardware. Simulators lie about gesture feel.
- **Review your work the next day.** You notice imperfections with fresh eyes. Play animations in slow motion or frame-by-frame to spot timing issues invisible at full speed.
- **When feel can't be judged from code, say so.** Name the check: "play it at 2–5× duration," "step frame by frame," "test gestures on real device." Don't guess at values.

---

# Professional Development Discipline — MANDATORY

These rules encode the working discipline of a senior developer. Violating them is as serious as violating the security rules above.

## 1. Question every requirement BEFORE touching code

Before implementing anything, run this checklist:

1. **Is this in scope for MVP?** If not, STOP and ask.
2. **Is the requirement precise enough to implement?** If ambiguous, surface it. Propose a default answer with a one-sentence trade-off, then wait.
3. **Does it contradict any existing decision?** If yes, flag it — do not silently pick one.
4. **Is there a simpler way?** If adding complexity for marginal benefit, push back.
5. **What are the edge cases?** Invent 2–3 concrete scenarios that probe boundaries before writing a line of code.

**The grilling discipline**: When a design decision has multiple paths, present them as a numbered list of questions with your recommended answer for each. Wait for the user's response. Never answer your own design questions.

## 2. Build a feedback loop BEFORE fixing bugs

When something is broken or failing — follow this exact sequence:

1. **Build a tight feedback loop** — a failing test, a CLI invocation, a throwaway harness that drives the bug code path. It must be red-capable, deterministic, fast, and agent-runnable.
2. **Reproduce and minimise** — confirm it fails with the user's exact symptom, then shrink to the smallest scenario that still fails.
3. **Hypothesise** — generate 3–5 ranked, falsifiable hypotheses before testing any. Show the list before proceeding.
4. **Instrument** — one variable at a time. Tag debug logs with `[DEBUG-xxxx]`.
5. **Fix + regression test** — write the test before the fix. Watch it fail. Fix. Watch it pass.
6. **Cleanup** — remove all debug instrumentation, delete throwaway prototypes, state the correct hypothesis in the commit message.

**If you catch yourself reading code to build a theory before a feedback loop exists, STOP.** Jumping straight to a hypothesis is the exact failure this discipline prevents.

## 3. Test-driven development at pre-agreed seams

- **Red before green.** Write the failing test first, then only enough code to pass it.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Tests verify behavior through public interfaces, not implementation details.**
- **No tautological tests.** Expected values come from an independent source of truth.
- **No horizontal slicing.** Work in vertical slices: one test → one implementation → repeat.
- **Refactoring is separate from the loop.** It belongs to the code-review stage.

## 4. Two-axis code review on every change

### Standards axis
Does the code conform to project standards (security, performance, readability)?

Scan for Fowler code smells:
- **Mysterious Name** → rename it
- **Duplicated Code** → extract and share
- **Feature Envy** → move the method
- **Primitive Obsession** → give the concept its own type
- **Speculative Generality** → delete unused abstraction
- **Shotgun Surgery** → gather into one module

### Spec axis
Does the code match what was asked for?
- Requirements missing or partial
- Behaviour that wasn't asked for (scope creep)
- Requirements that look implemented but are wrong

**Report both axes separately.** One can mask the other.

## 5. Implementation workflow — the full loop

1. Read the spec / acceptance criteria first.
2. Explore the codebase. Read `CONTEXT.md` (if exists) and any ADRs.
3. Identify test seams. Prefer existing seams. Use the highest seam possible.
4. Implement using TDD at pre-agreed seams.
5. Run linting regularly, single test files regularly, full suite once at the end.
6. Run code review on your own work before committing.
7. Commit to the feature branch. Never to `main`.

## 6. Git safety — non-negotiable

- **Never force-push.** No `git push --force`.
- **Never `git reset --hard`** without explicit approval.
- **Never `git clean -f`** without explicit approval.
- **Branch per feature.** No commits to `main`. PRs only.

## 7. Communication discipline

- **Facts are my job, decisions are the user's.** Look up facts from docs and code. Present judgment calls as options with recommendations and wait.
- **Never silently assume.** If the answer isn't documented, ask.
- **Frame questions with a default answer.** "Do you want X? Default: Y. Trade-off: Z."
- **Surface contradictions immediately.** Don't pick one and run.

## 8. The pre-commit smell check

Before committing any code:

- [ ] Linting passes with zero warnings
- [ ] No `TODO: implement later` stubs
- [ ] No new packages without documented justification
- [ ] No unrelated refactoring mixed in with feature work
- [ ] All debug instrumentation (`[DEBUG-...]`) removed
- [ ] Accessibility: touch targets ≥ 44pt, reduced motion respected
- [ ] All tests pass
- [ ] Animation review checklist (section 11 above) passes for any new motion


<claude-mem-context>
# Memory Context

# [Home Assistant] recent context, 2026-09-10 5:48pm GMT+7

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 23 obs (6,319t read) | 364,986t work | 98% savings

### Sep 5, 2026
2573 10:09a 🟣 Expense Category Management System
2574 " 🔴 TypeScript Type Safety in App Test Suite
2575 " ✅ Notification Expense Reader Documentation Enhanced
### Sep 6, 2026
2581 10:27a 🔴 Notification expenses invisible when Firestore returns timestamp objects
2582 " 🔴 Headless task fails to generate expense document IDs
2583 " ✅ Test suite updated for timestamp and headless scenarios
2584 " ✅ Dashboard UI and documentation clarified for recent expenses
2585 10:32a 🔴 Fixed notification expense parser uuid initialization failure
2586 " 🔴 Enhanced Firestore timestamp parsing for expense date normalization
2587 " 🟣 Added category management for expense tracking
2588 " ✅ Renamed expense section from daily view to recent historical view
2589 " 🟣 Added comprehensive test coverage for notification expense flow
2590 " ✅ Release APK built and verified for deployment
### Sep 10, 2026
2749 11:38a ⚖️ Daily Dashboard Redesign Specification and Data Requirements
2750 " 🔵 Hardware Control Handlers Are Non-Functional Stubs
2756 11:53a 🟣 Failed save persistence with retry mechanism
2757 " 🟣 Historical week date range labeling in dashboard
2758 " 🟣 Touch target size compliance enforcement (48dp minimum)
2759 " 🔄 DashboardScreen styles extracted to dedicated stylesheet module
2760 " 🔵 Android notification timestamp now used for expense dating
2761 " ✅ Improved error boundary messaging in App component
2762 " ✅ Test suite fixes and typescript type corrections
2763 " ✅ Android release APK build prepared with Gradle
### Sep 14, 2026
2801 06:45a 🟣 Expense Deletion with In-Modal Confirmation
  - Added delete button in `ExpenseEditor.tsx` with dedicated confirmation prompt modal
  - Connected `deleteDoc` in `App.tsx` with Firestore persistence and haptic feedback
  - Added `delete_expense` tool declaration and execution handler in `JarvisToolExecutor.ts`
2802 06:45a 🔴 Income Category & Type Synchronization Bugfix
  - Fixed category "Income" remaining stuck as an expense in `expenseEditing.ts` and `ExpenseEditor.tsx`
  - Added interactive Segmented Type Switcher (`Expense` / `Income (+)`) in `ExpenseEditor.tsx`
  - Added fallback in `toEditableExpense` (`App.tsx`) to normalize records with category "Income" to `type: 'income'`
  - Fixed positive amount prefix (`+Rp ...`) and green badge rendering on dashboard
2803 06:45a 🟣 End-of-Day 1-by-1 AI Spending Review (Gemini Live)
  - Added `update_expense`, `delete_expense`, and `get_daily_expenses` tools to `JarvisToolExecutor.ts`
  - Injected itemized transaction context (IDs, times, amounts, merchants, banks, categories, notes) into `spendingContext`
  - Configured 1-by-1 conversational review instructions in `buildJarvisSystemInstruction` (`GeminiLiveService.ts`)
  - Added `sendTextMessage` in `GeminiLiveService.ts` for client content turn injection
  - Added dashboard triggers: "Review with Jarvis" spark chip on dashboard and "Review today's spending 1-by-1" in Voice Sheet
2804 08:25a ✅ Wireless ADB Release Build & Deployment
  - Compiled clean release APK (`./gradlew assembleRelease`, 79.8MB)
  - Successfully connected to physical device (`SM_S721B`) over wireless debugging (`192.168.210.217:37069`)
  - Streamed and installed release APK (`adb install -r app-release.apk`)
  - Successfully launched and verified `com.jarvisassistant/.MainActivity` in foreground
2805 09:45a 🟣 Phase 1: App Icon Overhaul & Adaptive Assets
  - Replaced broken low-contrast dark icon with high-contrast glowing cyan/titanium AI Arc-Reactor emblem
  - Sized emblem mathematically to 67% radius to perfectly fit Android 72dp safe-zone
  - Scaled across all mipmap densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi) for adaptive foreground and legacy fallbacks
  - Updated in-app branding logo `app_logo.png` (512x512) and `ic_launcher_background` (`#050D1A`)
  - Successfully compiled fresh release APK (`assembleRelease`, 80.5MB)



Access 365k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>