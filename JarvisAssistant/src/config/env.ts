export const Config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE',
  // Gemini Live Model (requires native audio support)
  GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.0-flash-exp',
  // Voices available: Aoede, Charon, Fenrir, Kore, Puck
  GEMINI_LIVE_VOICE: 'Aoede',
  getLiveWebSocketUrl(apiKey: string = Config.GEMINI_API_KEY): string {
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  },
};
