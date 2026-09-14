import { NativeModules } from 'react-native';
import {
  GeminiLiveService,
  buildJarvisSystemInstruction,
} from '../src/services/GeminiLiveService';


class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Auto-open on next tick for tests
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: 'Normal closure' });
  }

  receiveMessage(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

// Assign global mock
(globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

describe('GeminiLiveService', () => {
  let service: GeminiLiveService;
  let mockLiveAudioModule: {
    startRecording: jest.Mock;
    stopRecording: jest.Mock;
    playAudioChunk: jest.Mock;
    stopAudioPlayback: jest.Mock;
    addListener: jest.Mock;
    removeListeners: jest.Mock;
  };

  beforeEach(() => {
    MockWebSocket.instances = [];
    jest.clearAllMocks();

    mockLiveAudioModule = {
      startRecording: jest.fn().mockResolvedValue(true),
      stopRecording: jest.fn().mockResolvedValue(true),
      playAudioChunk: jest.fn(),
      stopAudioPlayback: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    };

    NativeModules.LiveAudioModule = mockLiveAudioModule;
    service = new GeminiLiveService({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    service.stopSession();
  });

  it('builds system instructions with dynamic spending context to avoid tool round-trip', () => {
    const defaultInstruction = buildJarvisSystemInstruction();
    expect(defaultInstruction).toContain('play_music');
    expect(defaultInstruction).toContain('control_light');

    const withContext = buildJarvisSystemInstruction('Today: IDR 50.000 spent');
    expect(withContext).toContain('DAILY SPENDING CONTEXT:');
    expect(withContext).toContain('Today: IDR 50.000 spent');
    expect(withContext).toContain('DO NOT call get_daily_recap');
    expect(withContext).toContain('DAILY 1-BY-1 SPENDING REVIEW:');
    expect(withContext).toContain('update_expense');
  });

  it('sends text message as clientContent turn over WebSocket', async () => {
    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    service.sendTextMessage('Let’s review today’s spending.');
    const ws = MockWebSocket.instances[0];
    const clientMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    expect(clientMsg.clientContent.turns[0].parts[0].text).toBe(
      'Let’s review today’s spending.',
    );
    expect(clientMsg.clientContent.turnComplete).toBe(true);
  });

  it('allows updating system instructions dynamically before starting session', async () => {
    service.setSystemInstruction('Custom instructions for testing');
    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];
    const setupMsg = JSON.parse(ws.sentMessages[0]);
    expect(setupMsg.setup.systemInstruction.parts[0].text).toBe(
      'Custom instructions for testing',
    );
  });


  it('connects to WebSocket and sends setup payload on open', async () => {
    await service.startSession();

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('key=test-api-key');

    // Wait a tick for onopen
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);
    const setupMsg = JSON.parse(ws.sentMessages[0]);
    expect(setupMsg.setup).toBeDefined();
    expect(setupMsg.setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setupMsg.setup.tools).toBeDefined();
    expect(mockLiveAudioModule.startRecording).toHaveBeenCalled();
  });

  it('forwards mic audio chunks to WebSocket', async () => {
    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];
    ws.sentMessages = []; // reset

    service.sendAudioChunk('base64-pcm-audio-data');

    expect(ws.sentMessages.length).toBe(1);
    const audioMsg = JSON.parse(ws.sentMessages[0]);
    expect(audioMsg.realtimeInput).toBeDefined();
    expect(audioMsg.realtimeInput.mediaChunks[0].mimeType).toBe('audio/pcm;rate=16000');
    expect(audioMsg.realtimeInput.mediaChunks[0].data).toBe('base64-pcm-audio-data');
  });

  it('routes incoming audio chunks to NativeModules.LiveAudioModule.playAudioChunk', async () => {
    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];

    ws.receiveMessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=24000',
                data: 'incoming-base64-audio',
              },
            },
          ],
        },
      },
    });

    expect(mockLiveAudioModule.playAudioChunk).toHaveBeenCalledWith('incoming-base64-audio');
  });

  it('handles barge-in / interruption by immediately stopping audio playback', async () => {
    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];

    ws.receiveMessage({
      serverContent: {
        interrupted: true,
      },
    });

    expect(mockLiveAudioModule.stopAudioPlayback).toHaveBeenCalled();
  });

  it('notifies transcript callbacks when receiving speech transcriptions', async () => {
    const transcriptSpy = jest.fn();
    service.on('transcript', transcriptSpy);

    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];

    ws.receiveMessage({
      serverContent: {
        inputTranscription: { text: 'Turn on the lights' },
      },
    });

    expect(transcriptSpy).toHaveBeenCalledWith({ role: 'user', text: 'Turn on the lights' });

    ws.receiveMessage({
      serverContent: {
        outputTranscription: { text: 'Turning on the lights now.' },
      },
    });

    expect(transcriptSpy).toHaveBeenCalledWith({ role: 'model', text: 'Turning on the lights now.' });
  });

  it('executes tool calls and sends tool response back over WebSocket', async () => {
    const mockLightHandler = jest.fn().mockResolvedValue({ success: true, message: 'Light on' });
    service.setToolHandlers({ onControlLight: mockLightHandler });

    await service.startSession();
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    const ws = MockWebSocket.instances[0];
    ws.sentMessages = []; // clear setup message

    ws.receiveMessage({
      toolCall: {
        functionCalls: [
          {
            id: 'call-100',
            name: 'control_light',
            args: { state: true, protocol: 'ble' },
          },
        ],
      },
    });

    // Wait for tool execution
    await new Promise<void>(resolve => setTimeout(resolve, 10));

    expect(mockLightHandler).toHaveBeenCalledWith({ state: true, protocol: 'ble' });
    expect(ws.sentMessages.length).toBe(1);
    const responseMsg = JSON.parse(ws.sentMessages[0]);
    expect(responseMsg.toolResponse).toBeDefined();
    expect(responseMsg.toolResponse.functionResponses[0].id).toBe('call-100');
    expect(responseMsg.toolResponse.functionResponses[0].response.output).toEqual({
      success: true,
      message: 'Light on',
    });
  });
});
