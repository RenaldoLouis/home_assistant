import { GEMINI_API_KEY, GEMINI_LIVE_MODEL } from '@env';

export const Config = {
  GEMINI_API_KEY: GEMINI_API_KEY || '',
  // Gemini Live model. 3.1 Flash Live answers in ~1 s; the older 2.5 native-audio
  // model took 5-15 s because it thinks before speaking (docs/voice-latency.md).
  GEMINI_LIVE_MODEL: GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview',
  // Voices available: Aoede, Charon, Fenrir, Kore, Puck
  GEMINI_LIVE_VOICE: 'Aoede',
  getLiveWebSocketUrl(apiKey?: string): string {
    const key = apiKey || Config.GEMINI_API_KEY;
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
  },
};
