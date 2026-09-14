import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { Config } from '../config/env';
import {
  JARVIS_TOOL_DECLARATIONS,
  ToolExecutionHandlers,
  executeJarvisTool,
} from './JarvisToolExecutor';

export type LiveSessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'disconnected'
  | 'error';

export interface TranscriptEvent {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiLiveOptions {
  apiKey?: string;
  model?: string;
  voiceName?: string;
  systemInstruction?: string;
  toolHandlers?: ToolExecutionHandlers;
}

export function buildJarvisSystemInstruction(spendingContext?: string): string {
  const sections: string[] = [
    'You are Jarvis, a personal AI home assistant. Keep responses natural, direct, concise, and friendly.',
    'VOICE & SPEED RULES:',
    '- Answer in ONE short, natural sentence (maximum 25 words). Never use lists or preamble.',
    '- If asked to play music or songs, call play_music with app="spotify" immediately.',
    '- If asked to turn lights or lamp on or off, call control_light immediately.',
  ];

  if (spendingContext && spendingContext.trim()) {
    sections.push(
      'DAILY SPENDING CONTEXT:',
      spendingContext.trim(),
      'CRITICAL: When asked how much the user spent today or about today\'s expenses, answer directly in one sentence using the figures above. DO NOT call get_daily_recap unless the user explicitly asks for another date.',
    );
  } else {
    sections.push(
      'If asked about daily spending and no context is given, call get_daily_recap immediately.',
    );
  }

  return sections.join('\n');
}

type EventCallback<T = unknown> = (data: T) => void;

export class GeminiLiveService {
  private apiKey: string;
  private model: string;
  private voiceName: string;
  private systemInstruction: string;
  private toolHandlers?: ToolExecutionHandlers;

  private ws: WebSocket | null = null;
  private status: LiveSessionStatus = 'idle';
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private audioChunkSubscription: EmitterSubscription | null = null;
  private nativeEventEmitter: NativeEventEmitter | null = null;

  constructor(options: GeminiLiveOptions = {}) {
    this.apiKey = options.apiKey || Config.GEMINI_API_KEY;
    this.model = options.model || Config.GEMINI_LIVE_MODEL;
    this.voiceName = options.voiceName || Config.GEMINI_LIVE_VOICE;
    this.systemInstruction =
      options.systemInstruction || buildJarvisSystemInstruction();
    this.toolHandlers = options.toolHandlers;

    if (NativeModules.LiveAudioModule) {
      this.nativeEventEmitter = new NativeEventEmitter(NativeModules.LiveAudioModule);
    }
  }

  public setSystemInstruction(instruction: string) {
    this.systemInstruction = instruction;
  }

  public setToolHandlers(handlers: ToolExecutionHandlers) {
    this.toolHandlers = handlers;
  }


  public getStatus(): LiveSessionStatus {
    return this.status;
  }

  public on(
    event: 'status' | 'transcript' | 'error' | string,
    callback: EventCallback<any>,
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown) {
    this.eventListeners.get(event)?.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[GeminiLiveService] Error in ${event} listener:`, err);
      }
    });
  }

  private setStatus(status: LiveSessionStatus) {
    this.status = status;
    this.emit('status', status);
  }

  public async startSession(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'connected' || this.status === 'listening' || this.status === 'speaking') {
      return;
    }

    this.setStatus('connecting');

    try {
      const url = Config.getLiveWebSocketUrl(this.apiKey);
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        this.setStatus('connected');
        this.sendSetupMessage();

        try {
          if (NativeModules.LiveAudioModule) {
            await NativeModules.LiveAudioModule.startRecording();

            if (this.nativeEventEmitter) {
              this.audioChunkSubscription = this.nativeEventEmitter.addListener(
                'onAudioChunk',
                (event: { data: string }) => {
                  if (event && event.data) {
                    this.sendAudioChunk(event.data);
                  }
                },
              );
            }
          }
          this.setStatus('listening');
        } catch (audioErr) {
          console.error('[GeminiLiveService] Failed to start audio recording:', audioErr);
        }
      };

      this.ws.onmessage = async (event: any) => {
        try {
          const parsed = this.parseEventData(event.data);
          const message = parsed instanceof Promise ? await parsed : parsed;
          if (message) {
            await this.handleServerMessage(message);
          }
        } catch (parseErr) {
          console.error('[GeminiLiveService] Failed to parse server message:', parseErr, 'type:', typeof event?.data);
        }
      };

      this.ws.onerror = (event: any) => {
        const errorMsg = event?.message || 'Gemini Live WebSocket encountered an error';
        console.error('[GeminiLiveService] WebSocket error:', errorMsg, event);
        this.emit('error', new Error(errorMsg));
      };

      this.ws.onclose = (event: any) => {
        console.log('[GeminiLiveService] WebSocket closed:', event?.code, event?.reason);
        this.cleanup();
        this.setStatus('disconnected');
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.setStatus('error');
      this.emit('error', error);
      this.cleanup();
    }
  }

  public stopSession(): void {
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        console.warn('[GeminiLiveService] Error closing socket:', err);
      }
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private cleanup(): void {
    if (this.audioChunkSubscription) {
      this.audioChunkSubscription.remove();
      this.audioChunkSubscription = null;
    }

    if (NativeModules.LiveAudioModule) {
      try {
        NativeModules.LiveAudioModule.stopRecording();
        NativeModules.LiveAudioModule.stopAudioPlayback();
      } catch (err) {
        console.warn('[GeminiLiveService] Error stopping native audio:', err);
      }
    }
  }

  private sendSetupMessage(): void {
    if (!this.ws || this.ws.readyState !== 1) return;

    const setupPayload = {
      setup: {
        model: this.model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName,
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.systemInstruction }],
        },
        tools: [
          {
            functionDeclarations: JARVIS_TOOL_DECLARATIONS,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  public sendAudioChunk(base64Data: string): void {
    if (!this.ws || this.ws.readyState !== 1) return;

    const audioPayload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(audioPayload));
  }

  private parseEventData(data: unknown): Record<string, unknown> | Promise<Record<string, unknown> | null> | null {
    if (!data) return null;

    if (typeof data === 'string') {
      return JSON.parse(data);
    }

    if (typeof data === 'object') {
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        return (async () => {
          let text = '';
          if (typeof (data as any).text === 'function') {
            text = await (data as any).text();
          } else if (typeof FileReader !== 'undefined') {
            text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(data as Blob);
            });
          }
          return JSON.parse(text);
        })();
      }

      if (data instanceof ArrayBuffer) {
        let text = '';
        if (typeof (globalThis as any).TextDecoder !== 'undefined') {
          text = new (globalThis as any).TextDecoder().decode(data);
        } else {
          const bytes = new Uint8Array(data);
          for (let i = 0; i < bytes.length; i++) {
            text += String.fromCharCode(bytes[i]);
          }
        }
        return JSON.parse(text);
      }

      return data as Record<string, unknown>;
    }

    return null;
  }

  private async handleServerMessage(message: Record<string, unknown>): Promise<void> {
    if (message.serverContent && typeof message.serverContent === 'object') {
      const serverContent = message.serverContent as Record<string, unknown>;

      // 1. Handle Barge-in / Interruption
      if (serverContent.interrupted === true) {
        if (NativeModules.LiveAudioModule) {
          NativeModules.LiveAudioModule.stopAudioPlayback();
        }
        this.setStatus('listening');
        return;
      }

      // 2. Handle Model Spoken Audio
      if (serverContent.modelTurn && typeof serverContent.modelTurn === 'object') {
        const modelTurn = serverContent.modelTurn as Record<string, unknown>;
        if (Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            if (part && typeof part === 'object' && 'inlineData' in part) {
              const inlineData = part.inlineData as { mimeType: string; data: string };
              if (inlineData?.data && NativeModules.LiveAudioModule) {
                this.setStatus('speaking');
                NativeModules.LiveAudioModule.playAudioChunk(inlineData.data);
              }
            }
          }
        }
      }

      // 3. Handle Turn Complete
      if (serverContent.turnComplete === true) {
        this.setStatus('listening');
      }

      // 4. Handle Transcriptions
      if (serverContent.inputTranscription && typeof serverContent.inputTranscription === 'object') {
        const inputTrans = serverContent.inputTranscription as { text?: string };
        if (inputTrans.text) {
          this.emit('transcript', { role: 'user', text: inputTrans.text });
        }
      }

      if (serverContent.outputTranscription && typeof serverContent.outputTranscription === 'object') {
        const outputTrans = serverContent.outputTranscription as { text?: string };
        if (outputTrans.text) {
          this.emit('transcript', { role: 'model', text: outputTrans.text });
        }
      }
    }

    // 5. Handle Tool Calls
    if (message.toolCall && typeof message.toolCall === 'object') {
      const toolCall = message.toolCall as { functionCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }> };
      if (Array.isArray(toolCall.functionCalls)) {
        const functionResponses = [];
        for (const fc of toolCall.functionCalls) {
          const response = await executeJarvisTool(fc.id, fc.name, fc.args, this.toolHandlers);
          functionResponses.push(response);
        }

        const toolResponsePayload = {
          toolResponse: {
            functionResponses,
          },
        };

        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(JSON.stringify(toolResponsePayload));
        }
      }
    }
  }
}
