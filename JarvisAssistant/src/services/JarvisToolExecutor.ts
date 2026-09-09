export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const JARVIS_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'control_light',
    description: 'Turn a smart light on or off via Bluetooth Low Energy (BLE) or Wi-Fi.',
    parameters: {
      type: 'OBJECT',
      properties: {
        state: {
          type: 'BOOLEAN',
          description: 'True to turn on, false to turn off.',
        },
        protocol: {
          type: 'STRING',
          description: 'Either "wifi" or "ble". Defaults to "wifi".',
        },
      },
      required: ['state'],
    },
  },
  {
    name: 'play_music',
    description: 'Play music on a specific app like Spotify.',
    parameters: {
      type: 'OBJECT',
      properties: {
        app: {
          type: 'STRING',
          description: 'The app to launch, e.g. "spotify".',
        },
      },
      required: ['app'],
    },
  },
  {
    name: 'get_daily_recap',
    description: 'Get a recap of all daily expenses and spending tracked today.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'Optional date (YYYY-MM-DD) to get recap for. Defaults to today.',
        },
      },
    },
  },
];

export interface ToolExecutionHandlers {
  onControlLight?: (args: { state: boolean; protocol?: string }) => Promise<{ success: boolean; message: string }>;
  onPlayMusic?: (args: { app: string }) => Promise<{ success: boolean; message: string }>;
  onGetDailyRecap?: (args?: { date?: string }) => string | Promise<string>;
}

export interface FunctionResponsePayload {
  id: string;
  response: {
    output: Record<string, unknown>;
  };
}

export async function executeJarvisTool(
  callId: string,
  name: string,
  args: Record<string, unknown>,
  handlers?: ToolExecutionHandlers,
): Promise<FunctionResponsePayload> {
  try {
    switch (name) {
      case 'control_light': {
        const state = Boolean(args.state);
        const protocol = (args.protocol as string) || 'wifi';
        if (handlers?.onControlLight) {
          const result = await handlers.onControlLight({ state, protocol });
          return { id: callId, response: { output: result } };
        }
        return {
          id: callId,
          response: { output: { success: true, message: `Light turned ${state ? 'on' : 'off'}` } },
        };
      }

      case 'play_music': {
        const app = (args.app as string) || 'spotify';
        if (handlers?.onPlayMusic) {
          const result = await handlers.onPlayMusic({ app });
          return { id: callId, response: { output: result } };
        }
        return {
          id: callId,
          response: { output: { success: true, message: `Playing music on ${app}` } },
        };
      }

      case 'get_daily_recap': {
        const date = args.date as string | undefined;
        if (handlers?.onGetDailyRecap) {
          const summary = await handlers.onGetDailyRecap({ date });
          return { id: callId, response: { output: { summary } } };
        }
        return {
          id: callId,
          response: { output: { summary: 'No spending recorded for today.' } },
        };
      }

      default:
        return {
          id: callId,
          response: { output: { error: `Unknown tool: ${name}` } },
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return {
      id: callId,
      response: { output: { error: message } },
    };
  }
}
