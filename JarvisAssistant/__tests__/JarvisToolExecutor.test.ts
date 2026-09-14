import { executeJarvisTool, JARVIS_TOOL_DECLARATIONS } from '../src/services/JarvisToolExecutor';

describe('JarvisToolExecutor', () => {
  it('defines valid Gemini Live tool declarations', () => {
    expect(Array.isArray(JARVIS_TOOL_DECLARATIONS)).toBe(true);
    const names = JARVIS_TOOL_DECLARATIONS.map(t => t.name);
    expect(names).toContain('control_light');
    expect(names).toContain('play_music');
    expect(names).toContain('get_daily_recap');
    expect(names).toContain('update_expense');
    expect(names).toContain('delete_expense');
    expect(names).toContain('get_daily_expenses');
  });

  it('executes update_expense successfully', async () => {
    const mockUpdateHandler = jest.fn().mockResolvedValue({
      success: true,
      message: 'Updated expense to Food with note lunch',
    });
    const result = await executeJarvisTool(
      'call-up-1',
      'update_expense',
      {
        expense_id: 'exp-123',
        category: 'Food',
        note: 'lunch',
      },
      {
        onUpdateExpense: mockUpdateHandler,
      },
    );

    expect(mockUpdateHandler).toHaveBeenCalledWith({
      expense_id: 'exp-123',
      category: 'Food',
      note: 'lunch',
    });
    expect(result).toEqual({
      id: 'call-up-1',
      response: {
        output: {
          success: true,
          message: 'Updated expense to Food with note lunch',
        },
      },
    });
  });

  it('executes delete_expense successfully', async () => {
    const mockDeleteHandler = jest.fn().mockResolvedValue({
      success: true,
      message: 'Deleted expense exp-123',
    });
    const result = await executeJarvisTool(
      'call-del-1',
      'delete_expense',
      { expense_id: 'exp-123' },
      {
        onDeleteExpense: mockDeleteHandler,
      },
    );

    expect(mockDeleteHandler).toHaveBeenCalledWith({
      expense_id: 'exp-123',
    });
    expect(result).toEqual({
      id: 'call-del-1',
      response: {
        output: {
          success: true,
          message: 'Deleted expense exp-123',
        },
      },
    });
  });

  it('executes get_daily_expenses successfully', async () => {
    const mockGetExpensesHandler = jest.fn().mockResolvedValue({
      expenses: [
        {
          id: 'exp-1',
          amount: 50000,
          category: 'Food',
          merchant: 'Resto',
        },
      ],
    });
    const result = await executeJarvisTool(
      'call-get-1',
      'get_daily_expenses',
      { date: '2026-09-14' },
      {
        onGetDailyExpenses: mockGetExpensesHandler,
      },
    );

    expect(mockGetExpensesHandler).toHaveBeenCalledWith({
      date: '2026-09-14',
    });
    expect(result).toEqual({
      id: 'call-get-1',
      response: {
        output: {
          expenses: [
            {
              id: 'exp-1',
              amount: 50000,
              category: 'Food',
              merchant: 'Resto',
            },
          ],
        },
      },
    });
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
