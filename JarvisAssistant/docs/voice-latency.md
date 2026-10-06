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

## Known risks and follow-ups

- **3.1 Flash Live is a "legacy preview".** Google recommends `gemini-3.8-live`. Once 3.8 stops returning `1011`, re-measure and switch (one config line). 3.8 makes tools non-blocking by default and keeps proactive audio always on, so re-check the tool flow when migrating.
- **Echo / self-interruption (unverified on device).** The mic uses `AudioSource.VOICE_RECOGNITION`, which has no echo cancellation, and keeps streaming while Jarvis talks through the loudspeaker. The faster end-of-speech detection could make the model hear itself and interrupt its own reply. Check on the device: interruptions appear as `Audio playback flushed and stopped` in `adb logcat -s LiveAudioModule` while Jarvis is speaking.
- **Cold start per tap.** Every tap opens a new WebSocket and sends setup (0.5–1.5 s). Pre-connecting when the app opens would hide this, but it keeps a session open and billing.
- **Transcripts are never requested.** The setup has no `inputAudioTranscription` / `outputAudioTranscription`, so the transcript listeners in `App.tsx` never fire.
