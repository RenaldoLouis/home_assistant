import { GEMINI_API_KEY, GEMINI_LIVE_MODEL } from '@env';

export const Config = {
  GEMINI_API_KEY: GEMINI_API_KEY || '',
  // Gemini Live Model (requires native audio support)
  GEMINI_LIVE_MODEL: GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-latest',
  // Voices available: Aoede, Charon, Fenrir, Kore, Puck
  GEMINI_LIVE_VOICE: 'Aoede',
  getLiveWebSocketUrl(apiKey?: string): string {
    const key = apiKey || Config.GEMINI_API_KEY;
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
  },
};
