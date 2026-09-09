import { executeJarvisTool, JARVIS_TOOL_DECLARATIONS } from '../src/services/JarvisToolExecutor';

describe('JarvisToolExecutor', () => {
  it('defines valid Gemini Live tool declarations', () => {
    expect(Array.isArray(JARVIS_TOOL_DECLARATIONS)).toBe(true);
    const names = JARVIS_TOOL_DECLARATIONS.map(t => t.name);
    expect(names).toContain('control_light');
    expect(names).toContain('play_music');
    expect(names).toContain('get_daily_recap');
  });

  it('executes control_light successfully', async () => {
    const mockLightHandler = jest.fn().mockResolvedValue({ success: true, message: 'Light turned on' });
    const result = await executeJarvisTool('call-1', 'control_light', { state: true, protocol: 'ble' }, {
      onControlLight: mockLightHandler,
    });

    expect(mockLightHandler).toHaveBeenCalledWith({ state: true, protocol: 'ble' });
    expect(result).toEqual({
      id: 'call-1',
      response: {
        output: { success: true, message: 'Light turned on' }
      }
    });
  });

  it('executes play_music successfully', async () => {
    const mockMusicHandler = jest.fn().mockResolvedValue({ success: true, message: 'Playing Spotify' });
    const result = await executeJarvisTool('call-2', 'play_music', { app: 'spotify' }, {
      onPlayMusic: mockMusicHandler,
    });

    expect(mockMusicHandler).toHaveBeenCalledWith({ app: 'spotify' });
    expect(result).toEqual({
      id: 'call-2',
      response: {
        output: { success: true, message: 'Playing Spotify' }
      }
    });
  });

  it('executes get_daily_recap with expense provider', async () => {
    const mockRecapProvider = jest.fn().mockReturnValue('You spent IDR 250,000 today.');
    const result = await executeJarvisTool('call-3', 'get_daily_recap', {}, {
      onGetDailyRecap: mockRecapProvider,
    });

    expect(mockRecapProvider).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'call-3',
      response: {
        output: { summary: 'You spent IDR 250,000 today.' }
      }
    });
  });

  it('returns safe error response for unknown tools', async () => {
    const result = await executeJarvisTool('call-4', 'unknown_tool', {});
    expect(result).toEqual({
      id: 'call-4',
      response: {
        output: { error: 'Unknown tool: unknown_tool' }
      }
    });
  });
});
