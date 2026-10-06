# Voice Reply Latency

Jarvis took roughly 10 seconds to start answering a spoken question. This doc records how that was measured, what caused it, and what changed.

## Result

Time from the end of the user's speech to the first audio from Gemini. Each row is 2–3 runs of the same synthesized question (`say` → 16 kHz PCM). It was streamed exactly like `LiveAudioModule`: 64 ms chunks at real-time pace, with the mic continuing to stream afterwards. "Room noise" adds a ±400 amplitude noise floor, roughly what the `VOICE_RECOGNITION` mic source picks up in a quiet room.

| Setup | Quiet | Room noise |
|---|---|---|
| **Before:** `gemini-2.5-flash-native-audio-latest`, server default VAD | 5.1–6.2 s | **5.4–15.7 s** |
| 2.5 with `thinkingBudget: 0` | 2.9–3.9 s | – |
| `gemini-3.1-flash-live-preview`, default VAD | 1.44 s | 1.4–1.7 s |
| **After:** 3.1 Flash Live, `END_SENSITIVITY_HIGH` + 500 ms silence | – | **1.04–1.2 s** |
| 3.1 Flash Live + 300 ms silence | – | 0.95–1.2 s (no real gain, more cut-off risk) |
| 3.1 Flash Live, question that calls `get_monthly_recap` | 2.1–2.6 s | – |
| `gemini-3.8-live` | Session closed with `1011 Internal error` in 12 of 14 runs, including a bare setup with no tools, instruction or voice | – |

Session connect plus setup takes another 0.5–1.5 s per tap, before the mic starts streaming.

## Root causes

1. **The 2.5 native-audio model thinks before it speaks.** It reported 34–187 thought tokens per turn, which cost about 2–3 s.
2. **End-of-speech detection under noise.** With the server default, background noise sometimes kept the 2.5 turn open for over 10 s (the 15.7 s run). The 3.1 model plus explicit VAD settings ends the turn about 0.7 s after speech stops.

## Changes

- `src/config/env.ts` defaults to `models/gemini-3.1-flash-live-preview`, and `.env` / `.env.example` set the same model. Its thinking defaults to `minimal`, so it reported 0 thought tokens.
- `GeminiLiveService.sendSetupMessage` sends `realtimeInputConfig.automaticActivityDetection` = `{ endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH', silenceDurationMs: 500, prefixPaddingMs: 100 }`.
- `GeminiLiveService.sendAudioChunk` sends `realtimeInput.audio` instead of the deprecated `realtimeInput.mediaChunks`.

Verified on 3.1: tool calls work, and a mid-session `clientContent` text turn (the daily-review button) gets a spoken reply in about 0.67 s.

## Deployment

- 2026-10-06: merged to `main` (`0e576ae`) and installed on the S24 FE as an arm64-only release APK (31.5 MB) over wireless ADB. The installed bundle was checked to contain `gemini-3.1-flash-live-preview` and `END_SENSITIVITY_HIGH`. Build steps: [wifi-debugging-guide.md](wifi-debugging-guide.md#release-build--wireless-install-s24-fe).
- The user confirmed replies are much faster on the S24 FE. They also reported Jarvis sometimes stopping mid-reply on the phone loudspeaker, which led to the echo fix below.
- 2026-10-06: echo fix merged to `main`. **Not built or installed yet**; the next release build includes it.

## Echo: Jarvis cutting off its own reply

**Symptom (S24 FE, phone loudspeaker):** Jarvis sometimes stops mid-sentence without the user speaking.

**Cause:** the mic (`AudioSource.VOICE_RECOGNITION`, no echo cancellation) keeps streaming while Jarvis talks. Gemini hears the reply coming out of the speaker, treats it as the user starting to talk, and sends `serverContent.interrupted`. The app then flushes playback.

**Reproduced off-device:** the harness "plays" each reply at real-time pace and mixes it back into the mic stream at a given gain, mirroring the app's flush on `interrupted` (3.1 Flash Live, the app's VAD settings, 2 runs each):

| Echo in the mic | Reply played before the cut-off |
|---|---|
| None | Full reply (9.7 s, 13.7 s), never interrupted |
| Gain 0.15 (faint) | 0.26–0.32 s |
| Gain 0.4 | 0.32–0.44 s |
| Gain 0.15 / 0.4 + `START_SENSITIVITY_LOW` | 0.26–0.38 s (no help) |
| **Gain 0.4 / 1.0, mic sent as silence while the reply plays + 300 ms** | **Full reply (9.6–13.9 s), never interrupted** |

**Fix (user decision: half-duplex):** `GeminiLiveService` projects when queued reply audio finishes playing. Each chunk adds its duration, from its byte length and the `rate=` in its MIME type, starting no earlier than now. Until that time plus `ECHO_TAIL_MS` (300 ms), `sendAudioChunk` sends same-length PCM silence instead of the mic audio. An `interrupted` message or ending the session clears the projection, so the mic is live again straight away.

**Trade-off:** the user can no longer interrupt Jarvis by talking over it. "Stop conversation" ends the session and stops playback instead. Android echo cancellation (`VOICE_COMMUNICATION` + `AcousticEchoCanceler`) would keep voice barge-in, but routes audio like a phone call (call volume, Bluetooth SCO). It was declined for now.

## Known risks and follow-ups

- **3.1 Flash Live is a "legacy preview".** Google recommends `gemini-3.8-live`. Once 3.8 stops returning `1011`, re-measure and switch (one config line). 3.8 makes tools non-blocking by default and keeps proactive audio always on, so re-check the tool flow when migrating.
- **Echo fix needs on-device confirmation.** If Jarvis still stops mid-reply, watch `adb logcat -s LiveAudioModule ReactNativeJS`. `Audio playback flushed and stopped` *without* a preceding `Audio recording stopped` means an `interrupted` still got through, so the projection or the 300 ms tail is too short for the phone's real playback latency. A `WebSocket closed` line at that moment instead points at the connection.
- **Cold start per tap.** Every tap opens a new WebSocket and sends setup (0.5–1.5 s). Pre-connecting when the app opens would hide this, but it keeps a session open and billing.
- **Transcripts are never requested.** The setup has no `inputAudioTranscription` / `outputAudioTranscription`, so the transcript listeners in `App.tsx` never fire.
